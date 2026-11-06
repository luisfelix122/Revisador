begin;
lock table public.evaluaciones, public.examenes_estudiantes, public.historial_entregas_estudiantes in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.examenes_estudiantes e where not exists(
  select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=e.id and h.numero_entrega=e.numero_entregas and h.ruta_archivo=e.ruta_imagen_examen
  and not exists(select 1 from public.historial_entregas_estudiantes posterior where posterior.examen_estudiante_id=e.id and posterior.numero_entrega>h.numero_entrega))) then
  raise exception 'Hay entregas activas que no coinciden con su historial';
 end if;
end $$;

-- El historial pasa a ser la única fuente de la ruta y el número activos.
drop trigger validar_carga_manual on public.examenes_estudiantes;
drop trigger registrar_primera_carga_docente on public.examenes_estudiantes;
drop trigger verificar_entrega_examen on public.examenes_estudiantes;
drop trigger verificar_entrega_historial on public.historial_entregas_estudiantes;
drop function privado.validar_carga_manual();
drop function privado.registrar_primera_carga_docente();
drop function privado.verificar_entrega_activa();
drop function privado.comprobar_entrega_activa(uuid);

-- Una ruta guardada en cualquier versión del historial no es huérfana.
drop policy limpiar_archivos_huerfanos on storage.objects;
create function privado.archivo_tiene_referencia(p_ruta text) returns boolean language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null or split_part(p_ruta,'/',1)<>auth.uid()::text then true else
  exists(select 1 from public.soluciones_profesor s where s.ruta_almacenamiento=p_ruta)
  or exists(select 1 from public.materiales_apoyo m where m.ruta_almacenamiento=p_ruta)
  or exists(select 1 from public.historial_entregas_estudiantes h where h.ruta_archivo=p_ruta)
 end
$$;
revoke all on function privado.archivo_tiene_referencia(text) from public,anon;
grant execute on function privado.archivo_tiene_referencia(text) to authenticated;
create policy limpiar_archivos_huerfanos on storage.objects for delete to authenticated using(
 bucket_id='evaluaciones' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not privado.archivo_tiene_referencia(name));

alter table public.examenes_estudiantes drop column ruta_imagen_examen;
alter table public.examenes_estudiantes drop column numero_entregas;

create function public.ruta_imagen_examen(p_examen public.examenes_estudiantes) returns text language sql stable security invoker set search_path='' as $$
 select h.ruta_archivo::text from public.historial_entregas_estudiantes h where h.examen_estudiante_id=p_examen.id order by h.numero_entrega desc limit 1
$$;
create function public.numero_entregas(p_examen public.examenes_estudiantes) returns integer language sql stable security invoker set search_path='' as $$
 select coalesce(max(h.numero_entrega),0)::integer from public.historial_entregas_estudiantes h where h.examen_estudiante_id=p_examen.id
$$;
revoke all on function public.ruta_imagen_examen(public.examenes_estudiantes),public.numero_entregas(public.examenes_estudiantes) from public,anon;
grant execute on function public.ruta_imagen_examen(public.examenes_estudiantes),public.numero_entregas(public.examenes_estudiantes) to authenticated,service_role;

-- Un examen solo puede confirmarse si tiene al menos una versión de archivo.
create function privado.verificar_existencia_entrega() returns trigger language plpgsql security definer set search_path='' as $$
declare v_examen uuid;
begin
 if tg_table_name='examenes_estudiantes' then v_examen:=new.id; else v_examen:=old.examen_estudiante_id; end if;
 if exists(select 1 from public.examenes_estudiantes where id=v_examen)
  and not exists(select 1 from public.historial_entregas_estudiantes where examen_estudiante_id=v_examen) then
  raise exception 'El examen debe tener una entrega' using errcode='23514';
 end if;
 return null;
end $$;
revoke all on function privado.verificar_existencia_entrega() from public,anon,authenticated;
create constraint trigger verificar_examen_con_entrega after insert on public.examenes_estudiantes deferrable initially deferred for each row execute function privado.verificar_existencia_entrega();
create constraint trigger verificar_historial_no_vacio after delete or update on public.historial_entregas_estudiantes deferrable initially deferred for each row execute function privado.verificar_existencia_entrega();

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
   if not exists(select 1 from public.evaluaciones where id=p_evaluacion and modalidad_recepcion='manual' and not carga_manual_finalizada) then raise exception 'Selecciona la carga manual y habilita la carga antes de subir exámenes.'; end if;
   insert into public.examenes_estudiantes(evaluacion_id,observaciones_generales) values(p_evaluacion,'') returning id into v_id;
   insert into public.historial_entregas_estudiantes(examen_estudiante_id,numero_entrega,ruta_archivo,motivo_reenvio) values(v_id,1,p_ruta,'Carga docente');
 end if;
 return jsonb_build_object('id',v_id);
end
$$;

create or replace function public.registrar_entrega_estudiante(
    p_token UUID,
    p_nombre TEXT,
    p_codigo TEXT,
    p_ruta TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_eval RECORD;
    v_examen RECORD;
    v_examen_id UUID;
    v_numero_entrega INT;
    v_nombre_limpio TEXT;
    v_codigo_limpio TEXT;
BEGIN
    v_nombre_limpio := COALESCE(NULLIF(trim(p_nombre), ''), 'nada');
    v_codigo_limpio := COALESCE(NULLIF(trim(p_codigo), ''), 'nada');

    IF lower(v_codigo_limpio) = 'nada' THEN
        RAISE EXCEPTION 'El código de estudiante es obligatorio para la entrega' USING errcode = '42200';
    END IF;

    SELECT id, recepcion_abierta, fecha_cierre_programada, permitir_reenvios_global, cantidad_estudiantes_esperados
    INTO v_eval
    FROM public.evaluaciones
    WHERE token_recepcion = p_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Evaluación no encontrada' USING errcode = '40400';
    END IF;

    -- Validar si está abierta y dentro del tiempo límite
    IF NOT v_eval.recepcion_abierta OR (v_eval.fecha_cierre_programada IS NOT NULL AND clock_timestamp() > v_eval.fecha_cierre_programada) THEN
        RAISE EXCEPTION 'La recepción de entregas para esta evaluación se encuentra cerrada.' USING errcode = '42300';
    END IF;

    IF p_ruta NOT LIKE 'estudiantes/' || v_eval.id::text || '/%' OR NOT EXISTS (
        SELECT 1 FROM storage.objects WHERE bucket_id = 'evaluaciones' AND name = p_ruta
    ) THEN
        RAISE EXCEPTION 'El archivo de la entrega no existe.' USING errcode = '42200';
    END IF;

    -- Verificar si el alumno ya realizó una entrega previa
    SELECT * INTO v_examen
    FROM public.examenes_estudiantes
    WHERE evaluacion_id = v_eval.id AND lower(trim(codigo_estudiante)) = lower(v_codigo_limpio);

    IF FOUND THEN
        -- Si ya existe entrega, verificar si tiene permiso de reenvío
        IF NOT (v_examen.permitir_reenvio OR v_eval.permitir_reenvios_global) THEN
            RAISE EXCEPTION 'Ya has realizado una entrega. Solicita autorización a tu docente para volver a subir tu examen.' USING errcode = '40900';
        END IF;

        SELECT coalesce(max(numero_entrega),0)+1 INTO v_numero_entrega FROM public.historial_entregas_estudiantes WHERE examen_estudiante_id=v_examen.id;

        -- Actualizar registro activo
        UPDATE public.examenes_estudiantes
        SET nombre_estudiante = v_nombre_limpio,
            permitir_reenvio = FALSE,
            estado_revision = 'pendiente',
            actualizado_en = NOW()
        WHERE id = v_examen.id;

        v_examen_id := v_examen.id;
    ELSE
        -- Validar si se ha alcanzado la cantidad de estudiantes esperados en aula
        IF v_eval.cantidad_estudiantes_esperados IS NOT NULL AND
           (SELECT COUNT(*) FROM public.examenes_estudiantes WHERE evaluacion_id = v_eval.id) >= v_eval.cantidad_estudiantes_esperados THEN
            RAISE EXCEPTION 'Se ha alcanzado el límite de estudiantes esperados (% alumnos) para este examen. Si estás en el aula, consulta con tu docente.', v_eval.cantidad_estudiantes_esperados
                USING errcode = '42301';
        END IF;

        -- Primera entrega
        v_numero_entrega := 1;
        INSERT INTO public.examenes_estudiantes(
            evaluacion_id,
            nombre_estudiante,
            codigo_estudiante,
            estado_revision,
            observaciones_generales
        ) VALUES (
            v_eval.id,
            v_nombre_limpio,
            v_codigo_limpio,
            'pendiente',
            ''
        ) RETURNING id INTO v_examen_id;
    END IF;

    -- Registrar copia inmutable en el historial
    INSERT INTO public.historial_entregas_estudiantes(
        examen_estudiante_id,
        numero_entrega,
        ruta_archivo,
        creado_en
    ) VALUES (
        v_examen_id,
        v_numero_entrega,
        p_ruta,
        NOW()
    );

    RETURN jsonb_build_object(
        'examen_id', v_examen_id,
        'numero_entrega', v_numero_entrega,
        'codigo_estudiante', v_codigo_limpio,
        'nombre_estudiante', v_nombre_limpio,
        'entregado_en', NOW()
    );
END;
$$;

create or replace function privado.configurar_modalidad_recepcion(p_evaluacion uuid, p_modalidad text, p_finalizada boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actual public.evaluaciones; v_hay_manual boolean; v_hay_examen boolean;
begin
  perform privado.exigir_propiedad(p_evaluacion);
  select * into v_actual from public.evaluaciones where id=p_evaluacion;
  if p_modalidad not in ('alumnos','manual') then return jsonb_build_object('ok',false,'detalle','Modalidad no válida.'); end if;
  select exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion),
    exists(select 1 from public.examenes_estudiantes x join lateral (select h.ruta_archivo from public.historial_entregas_estudiantes h where h.examen_estudiante_id=x.id order by h.numero_entrega desc limit 1) ultima on true where x.evaluacion_id=p_evaluacion and ultima.ruta_archivo not like 'estudiantes/%')
    into v_hay_examen, v_hay_manual;
  if p_modalidad='manual' and v_actual.recepcion_abierta then
    return jsonb_build_object('ok',false,'detalle','Cierra la recepción por enlace antes de usar la carga manual.');
  end if;
  if p_modalidad='alumnos' and v_actual.modalidad_recepcion='manual' and v_hay_manual and not v_actual.carga_manual_finalizada then
    return jsonb_build_object('ok',false,'detalle','Confirma que terminaste la carga manual antes de cambiar de modalidad.');
  end if;
  if p_finalizada is not null and p_modalidad <> 'manual' then
    return jsonb_build_object('ok',false,'detalle','La confirmación solo corresponde a la carga manual.');
  end if;
  if p_finalizada is true and not v_hay_examen then
    return jsonb_build_object('ok',false,'detalle','Sube al menos un examen antes de confirmar la carga.');
  end if;
  update public.evaluaciones set modalidad_recepcion=p_modalidad,
    carga_manual_finalizada=coalesce(p_finalizada,carga_manual_finalizada) where id=p_evaluacion;
  return jsonb_build_object('ok',true);
end $$;

create or replace function privado.guardar_resultado(p_examen uuid,p_resultado jsonb,p_intento uuid,p_revisado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_examen public.examenes_estudiantes; v_preguntas jsonb; v_total numeric; v_ruta text; begin
 select * into v_examen from public.examenes_estudiantes where id=p_examen;
 perform privado.exigir_propiedad(v_examen.evaluacion_id);
 select * into v_examen from public.examenes_estudiantes where id=p_examen for update;
 select ruta_archivo into v_ruta from public.historial_entregas_estudiantes where examen_estudiante_id=p_examen order by numero_entrega desc limit 1;
 if p_revisado then
   if v_examen.estado_revision<>'completado' then raise exception 'Primero califica el examen'; end if;
 elsif v_examen.estado_revision<>'procesando' or p_intento is distinct from v_examen.intento_id then raise exception 'Intento vencido'; end if;
 v_preguntas:=p_resultado->'preguntas';
 if jsonb_typeof(v_preguntas)<>'array' or jsonb_array_length(v_preguntas)<>(select count(*) from public.criterios_preguntas where evaluacion_id=v_examen.evaluacion_id) then raise exception 'Faltan preguntas'; end if;
 if exists(select 1 from jsonb_array_elements(v_preguntas) x where not exists(select 1 from public.criterios_preguntas c where c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int)) then raise exception 'Pregunta desconocida'; end if;
 if exists(select 1 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int
   where x->>'puntaje_obtenido' is null or (x->>'puntaje_obtenido')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
      or (x->>'puntaje_obtenido')::numeric <> trunc((x->>'puntaje_obtenido')::numeric,2)
      or (x->>'puntaje_obtenido')::numeric < 0 or (x->>'puntaje_obtenido')::numeric > c.puntaje_maximo) then
   raise exception 'Puntaje inválido: debe estar dentro del máximo y tener hasta dos decimales';
 end if;
 delete from public.detalles_preguntas where examen_estudiante_id=p_examen;
 insert into public.detalles_preguntas(examen_estudiante_id,criterio_versionado_id,puntaje_obtenido,respuesta_detectada,justificacion)
 select p_examen,cv.id,(x->>'puntaje_obtenido')::numeric,coalesce(nullif(trim(x->>'respuesta_detectada'),''),'nada'),x->>'justificacion'
 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int join privado.versiones_rubrica vr on vr.evaluacion_id=c.evaluacion_id and vr.activa join privado.criterios_versionados cv on cv.version_rubrica_id=vr.id and cv.numero_pregunta=c.numero_pregunta;
 select sum(puntaje_obtenido) into v_total from public.detalles_preguntas where examen_estudiante_id=p_examen;
 update public.examenes_estudiantes set nombre_estudiante=case when not p_revisado and v_ruta like 'estudiantes/%' then v_examen.nombre_estudiante else coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada') end,codigo_estudiante=case when not p_revisado and v_ruta like 'estudiantes/%' then v_examen.codigo_estudiante else coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada') end,observaciones_generales=p_resultado->>'observaciones_generales',estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;

create or replace function privado.iniciar_eliminacion_evaluacion(p_evaluacion uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_rutas jsonb;
begin
 select e.id into v_id from public.evaluaciones e
 join public.cursos c on c.id=e.curso_id join public.promociones_ciclos p on p.id=c.promocion_ciclo_id
 join public.escuelas s on s.id=p.escuela_id join public.facultades f on f.id=s.facultad_id
 join public.anios_academicos a on a.id=f.anio_academico_id
 where e.id=p_evaluacion and a.propietario_id=auth.uid() for update of e;
 if v_id is null then raise exception 'Evaluación no accesible' using errcode='42501'; end if;
 if exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion and estado_revision='procesando') then
   return jsonb_build_object('iniciado',false,'detalle','Espera a que termine la calificación antes de eliminar la evaluación.');
 end if;
 update public.evaluaciones set eliminando=true, recepcion_abierta=false where id=p_evaluacion;
 select coalesce(jsonb_agg(distinct ruta),'[]'::jsonb) into v_rutas from (
   select ruta_almacenamiento ruta from public.soluciones_profesor where evaluacion_id=p_evaluacion
   union select ruta_almacenamiento from public.materiales_apoyo where evaluacion_id=p_evaluacion
   union select h.ruta_archivo from public.historial_entregas_estudiantes h join public.examenes_estudiantes x on x.id=h.examen_estudiante_id where x.evaluacion_id=p_evaluacion
 ) archivos where ruta is not null;
 return jsonb_build_object('iniciado',true,'rutas',v_rutas);
end $$;

create or replace function privado.reclamar_limpieza_entregas(p_limite integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_fila record; v_rutas jsonb := '[]'::jsonb;
begin
 for v_fila in select ruta from privado.archivos_recepcion_pendientes
   where creado_en < now()-interval '1 hour' order by creado_en for update skip locked limit greatest(1,least(coalesce(p_limite,100),500)) loop
   if exists(select 1 from public.historial_entregas_estudiantes h where h.ruta_archivo=v_fila.ruta) then
     delete from privado.archivos_recepcion_pendientes where ruta=v_fila.ruta;
   else
     update privado.archivos_recepcion_pendientes set estado='limpiando' where ruta=v_fila.ruta;
     v_rutas := v_rutas || jsonb_build_array(v_fila.ruta);
   end if;
 end loop;
 return v_rutas;
end $$;

create or replace function privado.confirmar_limpieza_entregas(p_rutas jsonb) returns void language sql security definer set search_path='' as $$
 delete from privado.archivos_recepcion_pendientes q where q.estado='limpiando' and q.ruta in (select jsonb_array_elements_text(p_rutas))
 and not exists(select 1 from public.historial_entregas_estudiantes h where h.ruta_archivo=q.ruta)
$$;
notify pgrst, 'reload schema';
commit;
