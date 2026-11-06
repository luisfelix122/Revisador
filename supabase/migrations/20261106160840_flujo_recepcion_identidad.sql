-- Estado explícito de la modalidad y del cierre docente; no se modifican las entregas existentes.
alter table public.evaluaciones
  add column modalidad_recepcion text not null default 'alumnos' check (modalidad_recepcion in ('alumnos','manual')),
  add column recepcion_iniciada boolean not null default false,
  add column carga_manual_finalizada boolean not null default false;

-- Las evaluaciones antiguas se clasifican según sus entregas y su configuración previa.
update public.evaluaciones e set
  modalidad_recepcion = case when e.recepcion_abierta or e.fecha_cierre_programada is not null
    or exists(select 1 from public.examenes_estudiantes x join public.historial_entregas_estudiantes h on h.examen_estudiante_id=x.id where x.evaluacion_id=e.id)
    then 'alumnos' when exists(select 1 from public.examenes_estudiantes x where x.evaluacion_id=e.id) then 'manual' else 'alumnos' end,
  recepcion_iniciada = e.recepcion_abierta or e.fecha_cierre_programada is not null
    or exists(select 1 from public.examenes_estudiantes x join public.historial_entregas_estudiantes h on h.examen_estudiante_id=x.id where x.evaluacion_id=e.id),
  carga_manual_finalizada = exists(select 1 from public.examenes_estudiantes x where x.evaluacion_id=e.id)
    and (exists(select 1 from public.criterios_preguntas c where c.evaluacion_id=e.id)
      or exists(select 1 from public.examenes_estudiantes x where x.evaluacion_id=e.id and x.estado_revision='completado'));

create function privado.marcar_recepcion_iniciada() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.recepcion_abierta and not old.recepcion_abierta then
    if new.modalidad_recepcion <> 'alumnos' then raise exception 'Selecciona la recepción por enlace antes de abrirla.'; end if;
    new.recepcion_iniciada := true;
  end if;
  return new;
end $$;
revoke all on function privado.marcar_recepcion_iniciada() from public, anon, authenticated;
create trigger marcar_recepcion_iniciada before update of recepcion_abierta on public.evaluaciones
for each row execute function privado.marcar_recepcion_iniciada();

create function privado.configurar_modalidad_recepcion(p_evaluacion uuid, p_modalidad text, p_finalizada boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actual public.evaluaciones; v_hay_manual boolean; v_hay_examen boolean;
begin
  perform privado.exigir_propiedad(p_evaluacion);
  select * into v_actual from public.evaluaciones where id=p_evaluacion;
  if p_modalidad not in ('alumnos','manual') then return jsonb_build_object('ok',false,'detalle','Modalidad no válida.'); end if;
  select exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion),
    exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion and ruta_imagen_examen not like 'estudiantes/%')
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
revoke all on function privado.configurar_modalidad_recepcion(uuid,text,boolean) from public,anon;
grant execute on function privado.configurar_modalidad_recepcion(uuid,text,boolean) to authenticated;
create function public.configurar_modalidad_recepcion(p_evaluacion uuid, p_modalidad text, p_finalizada boolean default null) returns jsonb
language sql security invoker set search_path='' as $$ select privado.configurar_modalidad_recepcion(p_evaluacion,p_modalidad,p_finalizada) $$;
revoke all on function public.configurar_modalidad_recepcion(uuid,text,boolean) from public,anon;
grant execute on function public.configurar_modalidad_recepcion(uuid,text,boolean) to authenticated;

create function privado.validar_carga_manual() returns trigger language plpgsql security definer set search_path='' as $$
declare v_eval public.evaluaciones;
begin
  if new.ruta_imagen_examen not like 'estudiantes/%' then
    select * into v_eval from public.evaluaciones where id=new.evaluacion_id for update;
    if v_eval.modalidad_recepcion <> 'manual' or v_eval.carga_manual_finalizada then
      raise exception 'Selecciona la carga manual y habilita la carga antes de subir exámenes.';
    end if;
  end if;
  return new;
end $$;
revoke all on function privado.validar_carga_manual() from public,anon,authenticated;
create trigger validar_carga_manual before insert on public.examenes_estudiantes for each row execute function privado.validar_carga_manual();

-- La IA no reemplaza la identidad ingresada por el estudiante; el docente puede corregirla.
create or replace function privado.guardar_resultado(p_examen uuid,p_resultado jsonb,p_intento uuid,p_revisado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
 update public.examenes_estudiantes set nombre_estudiante=case when not p_revisado and (v_examen.ruta_imagen_examen like 'estudiantes/%' or exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=p_examen)) then v_examen.nombre_estudiante else coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada') end,codigo_estudiante=case when not p_revisado and (v_examen.ruta_imagen_examen like 'estudiantes/%' or exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=p_examen)) then v_examen.codigo_estudiante else coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada') end,observaciones_generales=p_resultado->>'observaciones_generales',nota_final=v_total,estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;
