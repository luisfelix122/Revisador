-- Permite un PDF por alumno para exámenes de varias páginas.
create or replace function privado.registrar_archivo(p_evaluacion uuid,p_tipo text,p_nombre text,p_formato text,p_ruta text,p_paginas int) returns jsonb language plpgsql security definer set search_path='' as $$
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
   if p_formato not in ('imagen','pdf') or (select count(*) from public.examenes_estudiantes where evaluacion_id=p_evaluacion)>=100 then raise exception 'Examen inválido o lote completo'; end if;
   insert into public.examenes_estudiantes(evaluacion_id,ruta_imagen_examen,observaciones_generales) values(p_evaluacion,p_ruta,'') returning id into v_id;
 end if;
 return jsonb_build_object('id',v_id);
end
$$;

-- Reserva durable de cargas públicas; solo el servidor puede gestionar la cola.
create table privado.archivos_recepcion_pendientes (
  ruta text primary key,
  evaluacion_id uuid references public.evaluaciones(id) on delete set null,
  creado_en timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente','limpiando'))
);
revoke all on table privado.archivos_recepcion_pendientes from public,anon,authenticated;
create index archivos_recepcion_pendientes_fecha on privado.archivos_recepcion_pendientes(creado_en);

create function privado.reservar_archivo_entrega(p_token uuid, p_ruta text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_eval public.evaluaciones;
begin
 select * into v_eval from public.evaluaciones where token_recepcion=p_token for update;
 if not found then raise exception 'Evaluación no encontrada' using errcode='40400'; end if;
 if not v_eval.recepcion_abierta or (v_eval.fecha_cierre_programada is not null and clock_timestamp()>v_eval.fecha_cierre_programada) then
   raise exception 'La recepción de entregas se encuentra cerrada.' using errcode='42300';
 end if;
 if p_ruta not like 'estudiantes/' || v_eval.id::text || '/%' or length(p_ruta)>500 then raise exception 'Ruta inválida' using errcode='42200'; end if;
 insert into privado.archivos_recepcion_pendientes(ruta,evaluacion_id) values(p_ruta,v_eval.id);
 return jsonb_build_object('reservado',true);
end $$;
revoke all on function privado.reservar_archivo_entrega(uuid,text) from public,anon,authenticated;
grant execute on function privado.reservar_archivo_entrega(uuid,text) to service_role;
create function public.reservar_archivo_entrega(p_token uuid,p_ruta text) returns jsonb language sql security invoker set search_path='' as $$ select privado.reservar_archivo_entrega(p_token,p_ruta) $$;
revoke all on function public.reservar_archivo_entrega(uuid,text) from public,anon,authenticated;
grant execute on function public.reservar_archivo_entrega(uuid,text) to service_role;

-- El registro y la limpieza compiten por la misma fila. Nunca se borra una entrega registrada.
create function privado.proteger_archivo_en_limpieza() returns trigger language plpgsql security definer set search_path='' as $$
declare v_estado text;
begin
 select estado into v_estado from privado.archivos_recepcion_pendientes where ruta=new.ruta_archivo for update;
 if v_estado='limpiando' then raise exception 'La carga venció; vuelve a enviar el examen.' using errcode='42300'; end if;
 return new;
end $$;
revoke all on function privado.proteger_archivo_en_limpieza() from public,anon,authenticated;
create trigger proteger_archivo_en_limpieza before insert on public.historial_entregas_estudiantes for each row execute function privado.proteger_archivo_en_limpieza();

create function privado.reclamar_limpieza_entregas(p_limite integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_fila record; v_rutas jsonb := '[]'::jsonb;
begin
 for v_fila in select ruta from privado.archivos_recepcion_pendientes
   where creado_en < now()-interval '1 hour' order by creado_en for update skip locked limit greatest(1,least(coalesce(p_limite,100),500)) loop
   if exists(select 1 from public.historial_entregas_estudiantes h where h.ruta_archivo=v_fila.ruta)
      or exists(select 1 from public.examenes_estudiantes e where e.ruta_imagen_examen=v_fila.ruta) then
     delete from privado.archivos_recepcion_pendientes where ruta=v_fila.ruta;
   else
     update privado.archivos_recepcion_pendientes set estado='limpiando' where ruta=v_fila.ruta;
     v_rutas := v_rutas || jsonb_build_array(v_fila.ruta);
   end if;
 end loop;
 return v_rutas;
end $$;
revoke all on function privado.reclamar_limpieza_entregas(integer) from public,anon,authenticated;
grant execute on function privado.reclamar_limpieza_entregas(integer) to service_role;
create function public.reclamar_limpieza_entregas(p_limite integer default 100) returns jsonb language sql security invoker set search_path='' as $$ select privado.reclamar_limpieza_entregas(p_limite) $$;
revoke all on function public.reclamar_limpieza_entregas(integer) from public,anon,authenticated;
grant execute on function public.reclamar_limpieza_entregas(integer) to service_role;

create function privado.confirmar_limpieza_entregas(p_rutas jsonb) returns void language sql security definer set search_path='' as $$
 delete from privado.archivos_recepcion_pendientes q where q.estado='limpiando' and q.ruta in (select jsonb_array_elements_text(p_rutas))
 and not exists(select 1 from public.historial_entregas_estudiantes h where h.ruta_archivo=q.ruta)
 and not exists(select 1 from public.examenes_estudiantes e where e.ruta_imagen_examen=q.ruta)
$$;
revoke all on function privado.confirmar_limpieza_entregas(jsonb) from public,anon,authenticated;
grant execute on function privado.confirmar_limpieza_entregas(jsonb) to service_role;
create function public.confirmar_limpieza_entregas(p_rutas jsonb) returns void language sql security invoker set search_path='' as $$ select privado.confirmar_limpieza_entregas(p_rutas) $$;
revoke all on function public.confirmar_limpieza_entregas(jsonb) from public,anon,authenticated;
grant execute on function public.confirmar_limpieza_entregas(jsonb) to service_role;
