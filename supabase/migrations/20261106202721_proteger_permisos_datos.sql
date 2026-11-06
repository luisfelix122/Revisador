-- TRUNCATE no aplica las políticas RLS. Las cuentas de la aplicación no
-- necesitan vaciar tablas, definir disparadores ni crear referencias SQL.
revoke truncate, trigger, references on all tables in schema public from public, anon, authenticated;

-- El historial solo se consulta; las entregas se escriben por funciones privadas.
revoke all on public.historial_entregas_estudiantes from public, anon, authenticated;
grant select on public.historial_entregas_estudiantes to authenticated;

-- Facilita la limpieza al eliminar una evaluación con cargas pendientes.
create index archivos_recepcion_pendientes_evaluacion on privado.archivos_recepcion_pendientes(evaluacion_id);
