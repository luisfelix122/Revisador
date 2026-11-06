do $$ begin
 if exists(select 1 from pg_attribute where attrelid='public.detalles_preguntas'::regclass and attname='puntaje_maximo' and not attisdropped) then
  raise exception 'El máximo todavía se duplica en el detalle';
 end if;
 if not has_function_privilege('authenticated','public.puntaje_maximo(public.detalles_preguntas)','execute') then raise exception 'El docente no puede consultar el máximo'; end if;
 if has_function_privilege('anon','public.puntaje_maximo(public.detalles_preguntas)','execute') then raise exception 'Un anónimo puede consultar máximos'; end if;
end $$;
