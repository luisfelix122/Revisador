-- El umbral es específico de la evaluación y conserva por defecto la proporción 10,5/20.
alter table public.evaluaciones add column puntaje_aprobatorio numeric(5,2);
update public.evaluaciones set puntaje_aprobatorio=round(puntaje_total_maximo * 0.525,2);
alter table public.evaluaciones alter column puntaje_aprobatorio set not null;
alter table public.evaluaciones add constraint ck_puntaje_aprobatorio check (puntaje_aprobatorio >= 0 and puntaje_aprobatorio <= puntaje_total_maximo);
create function privado.establecer_aprobatorio_inicial() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.puntaje_aprobatorio is null then new.puntaje_aprobatorio:=round(new.puntaje_total_maximo * 0.525,2); end if;
 return new;
end $$;
revoke all on function privado.establecer_aprobatorio_inicial() from public,anon,authenticated;
create trigger establecer_aprobatorio_inicial before insert on public.evaluaciones for each row execute function privado.establecer_aprobatorio_inicial();

create function privado.configurar_puntaje_aprobatorio(p_evaluacion uuid, p_puntaje numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_maximo numeric;
begin
 perform privado.exigir_propiedad(p_evaluacion);
 select puntaje_total_maximo into v_maximo from public.evaluaciones where id=p_evaluacion;
 if p_puntaje is null or p_puntaje in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or p_puntaje <> trunc(p_puntaje,2) or p_puntaje < 0 or p_puntaje > v_maximo then
  return jsonb_build_object('ok',false,'detalle','El mínimo debe estar entre cero y el puntaje máximo, con hasta dos decimales.');
 end if;
 update public.evaluaciones set puntaje_aprobatorio=p_puntaje where id=p_evaluacion;
 return jsonb_build_object('ok',true,'puntaje_aprobatorio',p_puntaje);
end $$;
revoke all on function privado.configurar_puntaje_aprobatorio(uuid,numeric) from public,anon;
grant execute on function privado.configurar_puntaje_aprobatorio(uuid,numeric) to authenticated;
create function public.configurar_puntaje_aprobatorio(p_evaluacion uuid,p_puntaje numeric) returns jsonb language sql security invoker set search_path='' as $$ select privado.configurar_puntaje_aprobatorio(p_evaluacion,p_puntaje) $$;
revoke all on function public.configurar_puntaje_aprobatorio(uuid,numeric) from public,anon;
grant execute on function public.configurar_puntaje_aprobatorio(uuid,numeric) to authenticated;

-- Valida la precisión antes de redondear y conserva la identidad de entregas autónomas.
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
 if exists(select 1 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int
   where x->>'puntaje_obtenido' is null or (x->>'puntaje_obtenido')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
      or (x->>'puntaje_obtenido')::numeric <> trunc((x->>'puntaje_obtenido')::numeric,2)
      or (x->>'puntaje_obtenido')::numeric < 0 or (x->>'puntaje_obtenido')::numeric > c.puntaje_maximo) then
   raise exception 'Puntaje inválido: debe estar dentro del máximo y tener hasta dos decimales';
 end if;
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
