begin;
lock table public.examenes_estudiantes, public.detalles_preguntas in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.detalles_preguntas d join privado.criterios_versionados c on c.id=d.criterio_versionado_id where d.numero_pregunta is distinct from c.numero_pregunta) then
  raise exception 'Hay detalles cuyo número no coincide con su criterio';
 end if;
end $$;
drop trigger vincular_criterio_versionado on public.detalles_preguntas;
drop function privado.vincular_criterio_versionado();
alter table public.detalles_preguntas drop constraint uq_detalle_examen_pregunta;
alter table public.detalles_preguntas drop column numero_pregunta;
alter table public.detalles_preguntas add constraint uq_detalle_examen_criterio unique(examen_estudiante_id,criterio_versionado_id);

create function privado.numero_detalle(p_detalle uuid) returns integer language sql stable security definer set search_path='' as $$
 select cv.numero_pregunta from public.detalles_preguntas d
 join privado.criterios_versionados cv on cv.id=d.criterio_versionado_id
 join public.examenes_estudiantes x on x.id=d.examen_estudiante_id
 join public.evaluaciones e on e.id=x.evaluacion_id join public.cursos c on c.id=e.curso_id
 join public.promociones_ciclos pc on pc.id=c.promocion_ciclo_id join public.escuelas s on s.id=pc.escuela_id
 join public.facultades f on f.id=s.facultad_id join public.anios_academicos a on a.id=f.anio_academico_id
 where d.id=p_detalle and a.propietario_id=auth.uid()
$$;
revoke all on function privado.numero_detalle(uuid) from public,anon;
grant execute on function privado.numero_detalle(uuid) to authenticated;
create function public.numero_pregunta(p_detalle public.detalles_preguntas) returns integer language sql stable security invoker set search_path='' as $$
 select privado.numero_detalle(p_detalle.id)
$$;
revoke all on function public.numero_pregunta(public.detalles_preguntas) from public,anon;
grant execute on function public.numero_pregunta(public.detalles_preguntas) to authenticated;

-- En una inserción el criterio debe pertenecer a la rúbrica activa del examen.
create function privado.validar_criterio_versionado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_maximo numeric;
begin
 if tg_op='UPDATE' and (new.examen_estudiante_id is distinct from old.examen_estudiante_id or new.criterio_versionado_id is distinct from old.criterio_versionado_id) then
  raise exception 'No se puede cambiar el criterio de un detalle existente' using errcode='23514';
 end if;
 select c.puntaje_maximo into v_maximo from privado.criterios_versionados c
 join privado.versiones_rubrica v on v.id=c.version_rubrica_id
 join public.examenes_estudiantes e on e.evaluacion_id=v.evaluacion_id
 where c.id=new.criterio_versionado_id and e.id=new.examen_estudiante_id and (tg_op='UPDATE' or v.activa);
 if v_maximo is null or new.puntaje_obtenido is null or new.puntaje_obtenido<0 or new.puntaje_obtenido>v_maximo then
  raise exception 'El puntaje no coincide con su criterio' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function privado.validar_criterio_versionado() from public,anon,authenticated;
create trigger validar_criterio_versionado before insert or update of examen_estudiante_id,criterio_versionado_id,puntaje_obtenido on public.detalles_preguntas
 for each row execute function privado.validar_criterio_versionado();

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
 insert into public.detalles_preguntas(examen_estudiante_id,criterio_versionado_id,puntaje_obtenido,respuesta_detectada,justificacion)
 select p_examen,cv.id,(x->>'puntaje_obtenido')::numeric,coalesce(nullif(trim(x->>'respuesta_detectada'),''),'nada'),x->>'justificacion'
 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int join privado.versiones_rubrica vr on vr.evaluacion_id=c.evaluacion_id and vr.activa join privado.criterios_versionados cv on cv.version_rubrica_id=vr.id and cv.numero_pregunta=c.numero_pregunta;
 select sum(puntaje_obtenido) into v_total from public.detalles_preguntas where examen_estudiante_id=p_examen;
 update public.examenes_estudiantes set nombre_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.nombre_estudiante else coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada') end,codigo_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.codigo_estudiante else coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada') end,observaciones_generales=p_resultado->>'observaciones_generales',estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;
notify pgrst, 'reload schema';
commit;
