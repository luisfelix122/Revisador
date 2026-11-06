-- La nota es una proyección de las preguntas, no una segunda fuente de verdad.
do $$ begin
 if exists(select 1 from pg_attribute where attrelid='public.examenes_estudiantes'::regclass and attname='nota_final' and not attisdropped) then
  raise exception 'La nota todavía se almacena en el examen';
 end if;
 if not has_function_privilege('authenticated','public.nota_final(public.examenes_estudiantes)','execute') then
  raise exception 'El docente no puede consultar la nota derivada';
 end if;
 if has_function_privilege('anon','public.nota_final(public.examenes_estudiantes)','execute') then
  raise exception 'Un usuario anónimo puede consultar notas';
 end if;
end $$;
