-- La marca permite reintentar una limpieza interrumpida sin perder las rutas.
alter table public.evaluaciones add column eliminando boolean not null default false;

create or replace function privado.exigir_propiedad(p_evaluacion uuid) returns void language plpgsql security invoker set search_path='' as $$
declare v_eliminando boolean;
begin
 select e.eliminando into v_eliminando from public.evaluaciones e
 join public.cursos c on c.id=e.curso_id join public.promociones_ciclos p on p.id=c.promocion_ciclo_id
 join public.escuelas s on s.id=p.escuela_id join public.facultades f on f.id=s.facultad_id
 join public.anios_academicos a on a.id=f.anio_academico_id
 where e.id=p_evaluacion and a.propietario_id=auth.uid() for update of e;
 if not found then raise exception 'Evaluación no accesible' using errcode='42501'; end if;
 if v_eliminando then raise exception 'La evaluación se está eliminando' using errcode='55000'; end if;
end $$;

create function privado.renombrar_evaluacion(p_evaluacion uuid, p_titulo text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform privado.exigir_propiedad(p_evaluacion);
 if p_titulo is null or length(trim(p_titulo)) not between 1 and 255 then raise exception 'Título inválido' using errcode='22023'; end if;
 update public.evaluaciones set titulo=trim(p_titulo) where id=p_evaluacion;
 return jsonb_build_object('titulo',trim(p_titulo));
end $$;
revoke all on function privado.renombrar_evaluacion(uuid,text) from public, anon;
grant execute on function privado.renombrar_evaluacion(uuid,text) to authenticated;
create function public.renombrar_evaluacion(p_evaluacion uuid, p_titulo text) returns jsonb language sql security invoker set search_path='' as $$ select privado.renombrar_evaluacion(p_evaluacion,p_titulo) $$;
revoke all on function public.renombrar_evaluacion(uuid,text) from public, anon;
grant execute on function public.renombrar_evaluacion(uuid,text) to authenticated;

create function privado.iniciar_eliminacion_evaluacion(p_evaluacion uuid) returns jsonb
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
   union select ruta_imagen_examen from public.examenes_estudiantes where evaluacion_id=p_evaluacion
   union select h.ruta_archivo from public.historial_entregas_estudiantes h join public.examenes_estudiantes x on x.id=h.examen_estudiante_id where x.evaluacion_id=p_evaluacion
 ) archivos where ruta is not null;
 return jsonb_build_object('iniciado',true,'rutas',v_rutas);
end $$;
revoke all on function privado.iniciar_eliminacion_evaluacion(uuid) from public, anon;
grant execute on function privado.iniciar_eliminacion_evaluacion(uuid) to authenticated;
create function public.iniciar_eliminacion_evaluacion(p_evaluacion uuid) returns jsonb language sql security invoker set search_path='' as $$ select privado.iniciar_eliminacion_evaluacion(p_evaluacion) $$;
revoke all on function public.iniciar_eliminacion_evaluacion(uuid) from public, anon;
grant execute on function public.iniciar_eliminacion_evaluacion(uuid) to authenticated;

-- Solo el servidor con clave secreta puede completar el borrado tras limpiar Storage.
create function privado.finalizar_eliminacion_evaluacion(p_evaluacion uuid, p_propietario uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 delete from public.evaluaciones e using public.cursos c, public.promociones_ciclos p, public.escuelas s, public.facultades f, public.anios_academicos a
 where e.id=p_evaluacion and e.eliminando and c.id=e.curso_id and p.id=c.promocion_ciclo_id and s.id=p.escuela_id and f.id=s.facultad_id and a.id=f.anio_academico_id and a.propietario_id=p_propietario;
 if not found then raise exception 'Evaluación no accesible' using errcode='42501'; end if;
 return jsonb_build_object('eliminado',true);
end $$;
revoke all on function privado.finalizar_eliminacion_evaluacion(uuid,uuid) from public, anon, authenticated;
grant usage on schema privado to service_role;
grant execute on function privado.finalizar_eliminacion_evaluacion(uuid,uuid) to service_role;
create function public.finalizar_eliminacion_evaluacion(p_evaluacion uuid, p_propietario uuid) returns jsonb
language sql security invoker set search_path='' as $$ select privado.finalizar_eliminacion_evaluacion(p_evaluacion,p_propietario) $$;
revoke all on function public.finalizar_eliminacion_evaluacion(uuid,uuid) from public, anon, authenticated;
grant execute on function public.finalizar_eliminacion_evaluacion(uuid,uuid) to service_role;
