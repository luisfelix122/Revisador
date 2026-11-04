-- Una respuesta vacía o "nada", con cualquier capitalización, no suma puntos.
alter table public.detalles_preguntas drop constraint ck_respuesta_vacia;
alter table public.detalles_preguntas add constraint ck_respuesta_vacia
 check (lower(trim(coalesce(respuesta_detectada, ''))) not in ('', 'nada') or puntaje_obtenido = 0);
