do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.prosecdef
  and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))) then
  raise exception 'Hay funciones privilegiadas expuestas a los roles de aplicación';
 end if;
 if not has_function_privilege('anon','public.obtener_info_recepcion(uuid)','execute') then raise exception 'El enlace de alumnos dejó de ser público'; end if;
 if not has_function_privilege('authenticated','public.configurar_recepcion_docente(uuid,boolean,integer,boolean,integer)','execute') then raise exception 'El docente perdió la configuración de recepción'; end if;
end $$;
