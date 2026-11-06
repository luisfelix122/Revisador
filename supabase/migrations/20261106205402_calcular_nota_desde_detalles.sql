begin;
lock table public.examenes_estudiantes, public.detalles_preguntas in share row exclusive mode;
-- La migración no descarta discrepancias que pudieran necesitar revisión.
do $$ begin
 if exists(select 1 from public.examenes_estudiantes e where e.nota_final is distinct from
  (select coalesce(sum(d.puntaje_obtenido),0) from public.detalles_preguntas d where d.examen_estudiante_id=e.id)) then
  raise exception 'Hay notas que no coinciden con sus detalles';
 end if;
end $$;
drop trigger verificar_nota_examen on public.examenes_estudiantes;
drop trigger verificar_nota_detalle on public.detalles_preguntas;
drop function privado.verificar_nota_examen();
drop function privado.comprobar_nota_examen(uuid);
alter table public.examenes_estudiantes drop column nota_final;

-- PostgREST expone este campo calculado cuando se selecciona explícitamente.
-- SECURITY INVOKER conserva las políticas RLS sobre los detalles.
create function public.nota_final(p_examen public.examenes_estudiantes) returns numeric
 language sql stable security invoker set search_path='' as $$
 select coalesce(sum(d.puntaje_obtenido),0) from public.detalles_preguntas d where d.examen_estudiante_id=p_examen.id
$$;
revoke all on function public.nota_final(public.examenes_estudiantes) from public,anon;
grant execute on function public.nota_final(public.examenes_estudiantes) to authenticated,service_role;

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
 update public.examenes_estudiantes set nombre_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.nombre_estudiante else coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada') end,codigo_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.codigo_estudiante else coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada') end,observaciones_generales=p_resultado->>'observaciones_generales',estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;
notify pgrst, 'reload schema';
commit;
