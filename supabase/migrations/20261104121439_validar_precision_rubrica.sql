-- Mantiene los puntos atómicos de la rúbrica sin redondeos silenciosos.
create or replace function privado.guardar_rubrica(p_evaluacion uuid,p_preguntas jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_total numeric; begin
 perform privado.exigir_propiedad(p_evaluacion);
 if jsonb_typeof(p_preguntas)<>'array' or jsonb_array_length(p_preguntas) not between 1 and 100 then raise exception 'Rúbrica inválida'; end if;
 if exists(select 1 from public.examenes_estudiantes where evaluacion_id=p_evaluacion and estado_revision in ('procesando','completado')) then raise exception 'Rúbrica bloqueada durante calificación'; end if;
 if exists(select 1 from jsonb_array_elements(p_preguntas) x where (x->>'puntaje_maximo')::numeric <> trunc((x->>'puntaje_maximo')::numeric, 2)) then
   raise exception 'Los puntajes admiten como máximo dos decimales';
 end if;
 select sum((x->>'puntaje_maximo')::numeric) into v_total from jsonb_array_elements(p_preguntas) x;
 if v_total is distinct from (select puntaje_total_maximo from public.evaluaciones where id=p_evaluacion) then raise exception 'La suma de la rúbrica debe coincidir con el máximo'; end if;
 delete from public.criterios_preguntas where evaluacion_id=p_evaluacion;
 insert into public.criterios_preguntas(evaluacion_id,numero_pregunta,puntaje_maximo,respuesta_esperada)
 select p_evaluacion,(x->>'numero_pregunta')::int,(x->>'puntaje_maximo')::numeric,x->>'respuesta_esperada' from jsonb_array_elements(p_preguntas) x;
 return jsonb_build_object('guardada',true);
end $$;
