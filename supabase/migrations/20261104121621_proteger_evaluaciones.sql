-- Las escrituras sensibles de resultados se realizan por funciones transaccionales.
-- La aplicación actual no ofrece edición directa de evaluaciones.
revoke update on public.evaluaciones from authenticated;
