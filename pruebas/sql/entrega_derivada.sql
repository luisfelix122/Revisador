do $$ begin
 if exists(select 1 from pg_attribute where attrelid='public.examenes_estudiantes'::regclass and attname in ('ruta_imagen_examen','numero_entregas') and not attisdropped) then
  raise exception 'La entrega activa todavía se duplica en el examen';
 end if;
 if not has_function_privilege('authenticated','public.ruta_imagen_examen(public.examenes_estudiantes)','execute')
  or not has_function_privilege('authenticated','public.numero_entregas(public.examenes_estudiantes)','execute') then
  raise exception 'El docente no puede consultar la entrega activa';
 end if;
 if has_function_privilege('anon','public.ruta_imagen_examen(public.examenes_estudiantes)','execute') then
  raise exception 'Un anónimo puede consultar las rutas privadas';
 end if;
end $$;
