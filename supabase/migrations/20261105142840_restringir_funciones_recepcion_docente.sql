-- Los privilegios predeterminados de Supabase pueden conceder EXECUTE a anon.
REVOKE EXECUTE ON FUNCTION public.configurar_recepcion_docente(uuid, boolean, integer, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.permitir_reenvio_estudiante(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reiniciar_examen(uuid) FROM PUBLIC, anon;
