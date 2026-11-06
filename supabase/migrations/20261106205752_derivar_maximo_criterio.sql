begin;
lock table public.detalles_preguntas, public.examenes_estudiantes in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.detalles_preguntas d join privado.criterios_versionados c on c.id=d.criterio_versionado_id
  where d.puntaje_maximo is distinct from c.puntaje_maximo or d.numero_pregunta is distinct from c.numero_pregunta) then
  raise exception 'Hay preguntas que no coinciden con su criterio versionado';
 end if;
end $$;
drop trigger vincular_criterio_versionado on public.detalles_preguntas;
drop function privado.vincular_criterio_versionado();
alter table public.detalles_preguntas drop constraint ck_puntajes;
alter table public.detalles_preguntas drop column puntaje_maximo;
alter table public.detalles_preguntas add constraint ck_puntaje_obtenido_finito
 check (puntaje_obtenido >= 0 and puntaje_obtenido < 'Infinity'::numeric);

-- Devuelve el máximo solo si el criterio pertenece a la biblioteca del solicitante.
create function privado.maximo_detalle(p_detalle uuid) returns numeric language sql stable security definer set search_path='' as $$
 select cv.puntaje_maximo from public.detalles_preguntas d
 join privado.criterios_versionados cv on cv.id=d.criterio_versionado_id
 join public.examenes_estudiantes x on x.id=d.examen_estudiante_id
 join public.evaluaciones e on e.id=x.evaluacion_id join public.cursos c on c.id=e.curso_id
 join public.promociones_ciclos pc on pc.id=c.promocion_ciclo_id join public.escuelas s on s.id=pc.escuela_id
 join public.facultades f on f.id=s.facultad_id join public.anios_academicos a on a.id=f.anio_academico_id
 where d.id=p_detalle and a.propietario_id=auth.uid()
$$;
revoke all on function privado.maximo_detalle(uuid) from public,anon;
grant execute on function privado.maximo_detalle(uuid) to authenticated;
create function public.puntaje_maximo(p_detalle public.detalles_preguntas) returns numeric language sql stable security invoker set search_path='' as $$
 select privado.maximo_detalle(p_detalle.id)
$$;
revoke all on function public.puntaje_maximo(public.detalles_preguntas) from public,anon;
grant execute on function public.puntaje_maximo(public.detalles_preguntas) to authenticated;

-- Se valida el puntaje contra el criterio histórico, sin copiar el máximo.
create function privado.vincular_criterio_versionado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_maximo numeric;
begin
 if tg_op='UPDATE' and new.examen_estudiante_id=old.examen_estudiante_id and new.numero_pregunta=old.numero_pregunta then
  new.criterio_versionado_id:=old.criterio_versionado_id;
  select puntaje_maximo into v_maximo from privado.criterios_versionados where id=new.criterio_versionado_id;
 else
  select c.id,c.puntaje_maximo into new.criterio_versionado_id,v_maximo
  from public.examenes_estudiantes e join privado.versiones_rubrica v on v.evaluacion_id=e.evaluacion_id and v.activa
  join privado.criterios_versionados c on c.version_rubrica_id=v.id and c.numero_pregunta=new.numero_pregunta
  where e.id=new.examen_estudiante_id;
 end if;
 if new.criterio_versionado_id is null or v_maximo is null or new.puntaje_obtenido is null or new.puntaje_obtenido<0 or new.puntaje_obtenido>v_maximo then
  raise exception 'El puntaje no coincide con su criterio' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function privado.vincular_criterio_versionado() from public,anon,authenticated;
create trigger vincular_criterio_versionado before insert or update of examen_estudiante_id,numero_pregunta,criterio_versionado_id,puntaje_obtenido on public.detalles_preguntas
 for each row execute function privado.vincular_criterio_versionado();

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
 insert into public.detalles_preguntas(examen_estudiante_id,numero_pregunta,puntaje_obtenido,respuesta_detectada,justificacion)
 select p_examen,c.numero_pregunta,(x->>'puntaje_obtenido')::numeric,coalesce(nullif(trim(x->>'respuesta_detectada'),''),'nada'),x->>'justificacion'
 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int;
 select sum(puntaje_obtenido) into v_total from public.detalles_preguntas where examen_estudiante_id=p_examen;
 update public.examenes_estudiantes set nombre_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.nombre_estudiante else coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada') end,codigo_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.codigo_estudiante else coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada') end,observaciones_generales=p_resultado->>'observaciones_generales',estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;
notify pgrst, 'reload schema';
commit;
