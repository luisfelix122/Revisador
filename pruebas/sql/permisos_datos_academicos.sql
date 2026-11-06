-- Se ejecuta con una cuenta administrativa sobre una base de pruebas aislada.
do $$
declare tabla record; rol text; permiso text;
begin
 for tabla in select c.oid::regclass as nombre from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') loop
  foreach rol in array array['anon','authenticated'] loop
   foreach permiso in array array['TRUNCATE','TRIGGER','REFERENCES'] loop
    if has_table_privilege(rol,tabla.nombre,permiso) then
     raise exception 'El rol % tiene permiso % sobre %',rol,permiso,tabla.nombre;
    end if;
   end loop;
  end loop;
 end loop;
 if has_table_privilege('anon','public.historial_entregas_estudiantes','SELECT')
    or has_table_privilege('authenticated','public.historial_entregas_estudiantes','UPDATE')
    or has_table_privilege('authenticated','public.historial_entregas_estudiantes','DELETE') then
  raise exception 'El historial tiene permisos innecesarios';
 end if;
 if not has_table_privilege('authenticated','public.historial_entregas_estudiantes','SELECT') then
  raise exception 'El docente no puede consultar el historial';
 end if;
end $$;
