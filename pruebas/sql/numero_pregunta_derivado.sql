do $$ begin
 if exists(select 1 from pg_attribute where attrelid='public.detalles_preguntas'::regclass and attname='numero_pregunta' and not attisdropped) then
  raise exception 'El número todavía se duplica en el detalle';
 end if;
 if not has_function_privilege('authenticated','public.numero_pregunta(public.detalles_preguntas)','execute') then raise exception 'El docente no puede consultar el número'; end if;
 if has_function_privilege('anon','public.numero_pregunta(public.detalles_preguntas)','execute') then raise exception 'Un anónimo puede consultar números'; end if;
end $$;
