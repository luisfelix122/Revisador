-- Bloqueo preventivo hasta disponer de un borrado que limpie Storage mediante su API.
-- La interfaz actual no ofrece borrado de niveles académicos ni evaluaciones.
revoke delete on public.anios_academicos, public.facultades, public.escuelas,
 public.promociones_ciclos, public.cursos, public.evaluaciones from authenticated;
