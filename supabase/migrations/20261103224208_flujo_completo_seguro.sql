-- Persistencia atómica y aislamiento sin claves privilegiadas en la aplicación.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;
create table public.criterios_preguntas (
 id uuid primary key default gen_random_uuid(),
 evaluacion_id uuid not null references public.evaluaciones(id) on delete cascade,
 numero_pregunta int not null check(numero_pregunta between 1 and 100),
 puntaje_maximo numeric(5,2) not null check(puntaje_maximo > 0 and puntaje_maximo <= 100),
 respuesta_esperada text not null check(length(respuesta_esperada) between 1 and 10000),
 unique(evaluacion_id, numero_pregunta)
);
alter table public.criterios_preguntas enable row level security;
revoke all on public.criterios_preguntas from anon, authenticated;
grant select on public.criterios_preguntas to authenticated;
create policy leer_criterios_propios on public.criterios_preguntas for select to authenticated using(exists(select 1 from public.evaluaciones e where e.id=evaluacion_id));
alter table public.soluciones_profesor add column cantidad_paginas int not null default 1 check(cantidad_paginas between 1 and 20);
alter table public.materiales_apoyo add column cantidad_paginas int not null default 1 check(cantidad_paginas between 1 and 20);
alter table public.examenes_estudiantes add column intento_id uuid, add column revisado_por_profesor boolean not null default false;
alter table public.examenes_estudiantes alter column estado_revision set default 'pendiente';
-- Ninguna clave de IA se almacena en tablas ni en trabajos diferidos.
create function privado.exigir_propiedad(p_evaluacion uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists (
 select 1 from public.evaluaciones e join public.cursos c on c.id=e.curso_id join public.promociones_ciclos p on p.id=c.promocion_ciclo_id join public.escuelas s on s.id=p.escuela_id join public.facultades f on f.id=s.facultad_id join public.anios_academicos a on a.id=f.anio_academico_id where e.id=p_evaluacion and a.propietario_id=auth.uid()
 ) then raise exception 'Evaluación no accesible' using errcode='42501'; end if;
 perform 1 from public.evaluaciones where id=p_evaluacion for update;
end $$;
revoke all on function privado.exigir_propiedad(uuid) from public,anon,authenticated;
create function privado.registrar_archivo(p_evaluacion uuid,p_tipo text,p_nombre text,p_formato text,p_ruta text,p_paginas int) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
 perform privado.exigir_propiedad(p_evaluacion);
 if p_tipo not in ('solucion','material','examen') or length(p_nombre)>255 or p_paginas not between 1 and 20 or p_formato not in ('imagen','pdf','word') then raise exception 'Archivo inválido'; end if;
 if p_ruta not like auth.uid()::text || '/' || p_evaluacion::text || '/%' or not exists(select 1 from storage.objects where bucket_id='evaluaciones' and name=p_ruta) then raise exception 'Archivo privado no encontrado'; end if;
 if exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion and estado_revision in ('procesando','completado')) then raise exception 'La evaluación ya comenzó'; end if;
 if p_tipo='solucion' then
   if exists(select 1 from public.soluciones_profesor where evaluacion_id=p_evaluacion) then raise exception 'Ya existe solución'; end if;
   insert into public.soluciones_profesor(evaluacion_id,tipo_archivo,ruta_almacenamiento,cantidad_paginas) values(p_evaluacion,p_formato,p_ruta,p_paginas) returning id into v_id;
 elsif p_tipo='material' then
   if (select count(*) from public.materiales_apoyo where evaluacion_id=p_evaluacion)>=5 then raise exception 'Máximo cinco materiales'; end if;
   insert into public.materiales_apoyo(evaluacion_id,nombre_archivo,tipo_archivo,ruta_almacenamiento,cantidad_paginas) values(p_evaluacion,p_nombre,p_formato,p_ruta,p_paginas) returning id into v_id;
 else
   if p_formato<>'imagen' or (select count(*) from public.examenes_estudiantes where evaluacion_id=p_evaluacion)>=100 then raise exception 'Examen inválido o lote completo'; end if;
   insert into public.examenes_estudiantes(evaluacion_id,ruta_imagen_examen,observaciones_generales) values(p_evaluacion,p_ruta,'') returning id into v_id;
 end if;
 return jsonb_build_object('id',v_id);
end
$$;
revoke all on function privado.registrar_archivo(uuid,text,text,text,text,int) from public,anon;
grant execute on function privado.registrar_archivo(uuid,text,text,text,text,int) to authenticated;
create function public.registrar_archivo(p_evaluacion uuid,p_tipo text,p_nombre text,p_formato text,p_ruta text,p_paginas int) returns jsonb language sql security invoker set search_path='' as $$ select privado.registrar_archivo(p_evaluacion,p_tipo,p_nombre,p_formato,p_ruta,p_paginas) $$;
revoke all on function public.registrar_archivo(uuid,text,text,text,text,int) from public,anon;
grant execute on function public.registrar_archivo(uuid,text,text,text,text,int) to authenticated;

create function privado.guardar_rubrica(p_evaluacion uuid,p_preguntas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_total numeric; begin
 perform privado.exigir_propiedad(p_evaluacion);
 if jsonb_typeof(p_preguntas)<>'array' or jsonb_array_length(p_preguntas) not between 1 and 100 then raise exception 'Rúbrica inválida'; end if;
 if exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion and estado_revision in ('procesando','completado')) then raise exception 'Rúbrica bloqueada durante calificación'; end if;
 select sum((x->>'puntaje_maximo')::numeric) into v_total from jsonb_array_elements(p_preguntas) x;
 if v_total is distinct from (select puntaje_total_maximo from public.evaluaciones where id=p_evaluacion) then raise exception 'La suma de la rúbrica debe coincidir con el máximo'; end if;
 delete from public.criterios_preguntas where evaluacion_id=p_evaluacion;
 insert into public.criterios_preguntas(evaluacion_id,numero_pregunta,puntaje_maximo,respuesta_esperada)
 select p_evaluacion,(x->>'numero_pregunta')::int,(x->>'puntaje_maximo')::numeric,x->>'respuesta_esperada' from jsonb_array_elements(p_preguntas) x;
 return jsonb_build_object('guardada',true);
end
$$;
revoke all on function privado.guardar_rubrica(uuid,jsonb) from public,anon;
grant execute on function privado.guardar_rubrica(uuid,jsonb) to authenticated;
create function public.guardar_rubrica(p_evaluacion uuid,p_preguntas jsonb) returns jsonb language sql security invoker set search_path='' as $$ select privado.guardar_rubrica(p_evaluacion,p_preguntas) $$;
revoke all on function public.guardar_rubrica(uuid,jsonb) from public,anon;
grant execute on function public.guardar_rubrica(uuid,jsonb) to authenticated;

create function privado.iniciar_examen(p_examen uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_examen public.examenes_estudiantes; v_intento uuid; begin
 select * into v_examen from public.examenes_estudiantes where id=p_examen;
 perform privado.exigir_propiedad(v_examen.evaluacion_id);
 select * into v_examen from public.examenes_estudiantes where id=p_examen for update;
 if v_examen.estado_revision='completado' then return jsonb_build_object('completado',true); end if;
 if v_examen.estado_revision='procesando' and v_examen.actualizado_en > now()-interval '8 minutes' then raise exception 'Examen en procesamiento'; end if;
 if not exists(select 1 from public.criterios_preguntas where evaluacion_id=v_examen.evaluacion_id) then raise exception 'Confirma la rúbrica'; end if;
 v_intento:=gen_random_uuid();
 update public.examenes_estudiantes set estado_revision='procesando',intento_id=v_intento,actualizado_en=now() where id=p_examen;
 return jsonb_build_object('intento',v_intento,'completado',false);
end
$$;
revoke all on function privado.iniciar_examen(uuid) from public,anon;
grant execute on function privado.iniciar_examen(uuid) to authenticated;
create function public.iniciar_examen(p_examen uuid) returns jsonb language sql security invoker set search_path='' as $$ select privado.iniciar_examen(p_examen) $$;
revoke all on function public.iniciar_examen(uuid) from public,anon;
grant execute on function public.iniciar_examen(uuid) to authenticated;

create function privado.guardar_resultado(p_examen uuid,p_resultado jsonb,p_intento uuid,p_revisado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_examen public.examenes_estudiantes; v_preguntas jsonb; v_total numeric; begin
 select * into v_examen from public.examenes_estudiantes where id=p_examen;
 perform privado.exigir_propiedad(v_examen.evaluacion_id);
 select * into v_examen from public.examenes_estudiantes where id=p_examen for update;
 if p_revisado then
   if v_examen.estado_revision<>'completado' then raise exception 'Primero califica el examen'; end if;
 elsif v_examen.estado_revision<>'procesando' or p_intento is distinct from v_examen.intento_id then raise exception 'Intento vencido'; end if;
 v_preguntas:=p_resultado->'preguntas';
 if jsonb_typeof(v_preguntas)<>'array' or jsonb_array_length(v_preguntas)<>(select count(*) from public.criterios_preguntas where evaluacion_id=v_examen.evaluacion_id) then raise exception 'Faltan preguntas'; end if;
 if exists(select 1 from jsonb_array_elements(v_preguntas) x where not exists(select 1 from public.criterios_preguntas c where c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int)) then raise exception 'Pregunta desconocida'; end if;
 delete from public.detalles_preguntas where examen_estudiante_id=p_examen;
 insert into public.detalles_preguntas(examen_estudiante_id,numero_pregunta,puntaje_obtenido,puntaje_maximo,respuesta_detectada,justificacion)
 select p_examen,c.numero_pregunta,(x->>'puntaje_obtenido')::numeric,c.puntaje_maximo,coalesce(nullif(trim(x->>'respuesta_detectada'),''),'nada'),x->>'justificacion'
 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int;
 select sum(puntaje_obtenido) into v_total from public.detalles_preguntas where examen_estudiante_id=p_examen;
 update public.examenes_estudiantes set nombre_estudiante=coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada'),codigo_estudiante=coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada'),observaciones_generales=p_resultado->>'observaciones_generales',nota_final=v_total,estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;
revoke all on function privado.guardar_resultado(uuid,jsonb,uuid,boolean) from public,anon;
grant execute on function privado.guardar_resultado(uuid,jsonb,uuid,boolean) to authenticated;
create function public.guardar_resultado(p_examen uuid,p_resultado jsonb,p_intento uuid,p_revisado boolean) returns jsonb language sql security invoker set search_path='' as $$ select privado.guardar_resultado(p_examen,p_resultado,p_intento,p_revisado) $$;
revoke all on function public.guardar_resultado(uuid,jsonb,uuid,boolean) from public,anon;
grant execute on function public.guardar_resultado(uuid,jsonb,uuid,boolean) to authenticated;

create function privado.liberar_examen(p_examen uuid,p_intento uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_evaluacion uuid; begin
 select evaluacion_id into v_evaluacion from public.examenes_estudiantes where id=p_examen;
 perform privado.exigir_propiedad(v_evaluacion);
 update public.examenes_estudiantes set estado_revision='error',actualizado_en=now() where id=p_examen and intento_id=p_intento and estado_revision='procesando';
 return jsonb_build_object('liberado',true);
end
$$;
revoke all on function privado.liberar_examen(uuid,uuid) from public,anon;
grant execute on function privado.liberar_examen(uuid,uuid) to authenticated;
create function public.liberar_examen(p_examen uuid,p_intento uuid) returns jsonb language sql security invoker set search_path='' as $$ select privado.liberar_examen(p_examen,p_intento) $$;
revoke all on function public.liberar_examen(uuid,uuid) from public,anon;
grant execute on function public.liberar_examen(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evaluaciones','evaluaciones',false,3145728,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy archivos_propios_lectura on storage.objects for select to authenticated using(bucket_id='evaluaciones' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy archivos_propios_creacion on storage.objects for insert to authenticated with check(bucket_id='evaluaciones' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.evaluaciones e where e.id::text=(storage.foldername(name))[2]));
create policy limpiar_archivos_huerfanos on storage.objects for delete to authenticated using(bucket_id='evaluaciones' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.soluciones_profesor s where s.ruta_almacenamiento=name) and not exists(select 1 from public.materiales_apoyo m where m.ruta_almacenamiento=name) and not exists(select 1 from public.examenes_estudiantes x where x.ruta_imagen_examen=name));
