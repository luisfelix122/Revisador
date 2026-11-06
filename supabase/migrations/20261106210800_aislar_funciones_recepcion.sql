begin;
-- El token público sigue funcionando mediante una función invocadora; la
-- implementación privilegiada vive en un esquema no expuesto por PostgREST.
create schema recepcion_publica;
revoke all on schema recepcion_publica from public,anon,authenticated;
grant usage on schema recepcion_publica to anon,authenticated,service_role;
alter function public.obtener_info_recepcion(uuid) set schema recepcion_publica;
revoke all on function recepcion_publica.obtener_info_recepcion(uuid) from public,anon,authenticated;
grant execute on function recepcion_publica.obtener_info_recepcion(uuid) to anon,authenticated,service_role;
create function public.obtener_info_recepcion(p_token uuid) returns jsonb language sql security invoker set search_path='' as $$
 select recepcion_publica.obtener_info_recepcion(p_token)
$$;
revoke all on function public.obtener_info_recepcion(uuid) from public,anon,authenticated;
grant execute on function public.obtener_info_recepcion(uuid) to anon,authenticated,service_role;

-- Las operaciones docentes mantienen su comprobación de propiedad original.
alter function public.configurar_recepcion_docente(uuid,boolean,integer,boolean,integer) set schema privado;
revoke all on function privado.configurar_recepcion_docente(uuid,boolean,integer,boolean,integer) from public,anon,authenticated;
grant execute on function privado.configurar_recepcion_docente(uuid,boolean,integer,boolean,integer) to authenticated;
create function public.configurar_recepcion_docente(p_evaluacion uuid,p_abierta boolean,p_tiempo_minutos integer,p_reenvios_global boolean,p_estudiantes_esperados integer default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select privado.configurar_recepcion_docente(p_evaluacion,p_abierta,p_tiempo_minutos,p_reenvios_global,p_estudiantes_esperados)
$$;
revoke all on function public.configurar_recepcion_docente(uuid,boolean,integer,boolean,integer) from public,anon,authenticated;
grant execute on function public.configurar_recepcion_docente(uuid,boolean,integer,boolean,integer) to authenticated;

alter function public.permitir_reenvio_estudiante(uuid,boolean) set schema privado;
revoke all on function privado.permitir_reenvio_estudiante(uuid,boolean) from public,anon,authenticated;
grant execute on function privado.permitir_reenvio_estudiante(uuid,boolean) to authenticated;
create function public.permitir_reenvio_estudiante(p_examen uuid,p_permitir boolean) returns jsonb language sql security invoker set search_path='' as $$
 select privado.permitir_reenvio_estudiante(p_examen,p_permitir)
$$;
revoke all on function public.permitir_reenvio_estudiante(uuid,boolean) from public,anon,authenticated;
grant execute on function public.permitir_reenvio_estudiante(uuid,boolean) to authenticated;

alter function public.reiniciar_examen(uuid) set schema privado;
revoke all on function privado.reiniciar_examen(uuid) from public,anon,authenticated;
grant execute on function privado.reiniciar_examen(uuid) to authenticated;
create function public.reiniciar_examen(p_examen uuid) returns jsonb language sql security invoker set search_path='' as $$
 select privado.reiniciar_examen(p_examen)
$$;
revoke all on function public.reiniciar_examen(uuid) from public,anon,authenticated;
grant execute on function public.reiniciar_examen(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
