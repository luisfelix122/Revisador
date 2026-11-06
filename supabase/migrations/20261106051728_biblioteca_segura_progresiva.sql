-- Permite eliminar únicamente nodos propios sin descendientes.
create or replace function privado.eliminar_nodo_vacio(p_nivel text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tabla_hija text;
  v_columna_hija text;
  v_id uuid;
  v_tiene_hijos boolean;
begin
  if auth.uid() is null or p_nivel not in ('anios_academicos','facultades','escuelas','promociones_ciclos','cursos') then
    raise exception 'Elemento no accesible' using errcode = '42501';
  end if;
  execute format('select id from public.%I where id = $1 for update', p_nivel) into v_id using p_id;
  if v_id is null or not (
    (p_nivel = 'anios_academicos' and exists(select 1 from public.anios_academicos a where a.id=p_id and a.propietario_id=auth.uid())) or
    (p_nivel = 'facultades' and exists(select 1 from public.facultades f join public.anios_academicos a on a.id=f.anio_academico_id where f.id=p_id and a.propietario_id=auth.uid())) or
    (p_nivel = 'escuelas' and exists(select 1 from public.escuelas e join public.facultades f on f.id=e.facultad_id join public.anios_academicos a on a.id=f.anio_academico_id where e.id=p_id and a.propietario_id=auth.uid())) or
    (p_nivel = 'promociones_ciclos' and exists(select 1 from public.promociones_ciclos c join public.escuelas e on e.id=c.escuela_id join public.facultades f on f.id=e.facultad_id join public.anios_academicos a on a.id=f.anio_academico_id where c.id=p_id and a.propietario_id=auth.uid())) or
    (p_nivel = 'cursos' and exists(select 1 from public.cursos c join public.promociones_ciclos p on p.id=c.promocion_ciclo_id join public.escuelas e on e.id=p.escuela_id join public.facultades f on f.id=e.facultad_id join public.anios_academicos a on a.id=f.anio_academico_id where c.id=p_id and a.propietario_id=auth.uid()))
  ) then raise exception 'Elemento no accesible' using errcode = '42501'; end if;
  case p_nivel
    when 'anios_academicos' then v_tabla_hija := 'facultades'; v_columna_hija := 'anio_academico_id';
    when 'facultades' then v_tabla_hija := 'escuelas'; v_columna_hija := 'facultad_id';
    when 'escuelas' then v_tabla_hija := 'promociones_ciclos'; v_columna_hija := 'escuela_id';
    when 'promociones_ciclos' then v_tabla_hija := 'cursos'; v_columna_hija := 'promocion_ciclo_id';
    when 'cursos' then v_tabla_hija := 'evaluaciones'; v_columna_hija := 'curso_id';
  end case;
  execute format('select exists(select 1 from public.%I where %I=$1)', v_tabla_hija, v_columna_hija) into v_tiene_hijos using p_id;
  if v_tiene_hijos then
    return jsonb_build_object('eliminado', false, 'detalle', 'No se puede eliminar porque contiene elementos. Vacía este nivel primero.');
  end if;
  execute format('delete from public.%I where id=$1', p_nivel) using p_id;
  return jsonb_build_object('eliminado', true);
end $$;
revoke all on function privado.eliminar_nodo_vacio(text, uuid) from public, anon;
grant execute on function privado.eliminar_nodo_vacio(text, uuid) to authenticated;
create or replace function public.eliminar_nodo_vacio(p_nivel text, p_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select privado.eliminar_nodo_vacio(p_nivel, p_id)
$$;
revoke all on function public.eliminar_nodo_vacio(text, uuid) from public, anon;
grant execute on function public.eliminar_nodo_vacio(text, uuid) to authenticated;

-- Se respetan duplicados históricos; nuevas inserciones no pueden repetir el nombre
-- dentro del mismo padre, sin importar mayúsculas o espacios repetidos.
create or replace function privado.evitar_nombres_repetidos()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_nombre text; v_padre uuid; v_campo_nombre text; v_campo_padre text; v_repetido boolean;
begin
  v_campo_nombre := case when tg_table_name='promociones_ciclos' then 'denominacion' else 'nombre' end;
  v_campo_padre := case tg_table_name when 'facultades' then 'anio_academico_id' when 'escuelas' then 'facultad_id' when 'promociones_ciclos' then 'escuela_id' else 'promocion_ciclo_id' end;
  execute format('select ($1).%I::text, ($1).%I::uuid', v_campo_nombre, v_campo_padre) into v_nombre, v_padre using new;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tg_table_name || ':' || v_padre::text || ':' || lower(regexp_replace(trim(v_nombre), '\s+', ' ', 'g')), 0));
  execute format('select exists(select 1 from public.%I where %I=$1 and lower(regexp_replace(trim(%I), ''\s+'', '' '', ''g''))=lower(regexp_replace(trim($2), ''\s+'', '' '', ''g'')) and id is distinct from $3)', tg_table_name, v_campo_padre, v_campo_nombre)
    into v_repetido using v_padre, v_nombre, new.id;
  if v_repetido then raise exception 'Ya existe un elemento con ese nombre en esta ubicación.' using errcode='23505'; end if;
  if tg_table_name='promociones_ciclos' and (v_nombre ~ '[,;\n]' or v_nombre ~* '(^|[[:space:]])(y|e)([[:space:]]|$)') then raise exception 'Ingresa un solo ciclo a la vez.' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function privado.evitar_nombres_repetidos() from public, anon, authenticated;
create trigger validar_nombre_facultad before insert or update of nombre, anio_academico_id on public.facultades for each row execute function privado.evitar_nombres_repetidos();
create trigger validar_nombre_escuela before insert or update of nombre, facultad_id on public.escuelas for each row execute function privado.evitar_nombres_repetidos();
create trigger validar_nombre_ciclo before insert or update of denominacion, escuela_id on public.promociones_ciclos for each row execute function privado.evitar_nombres_repetidos();
create trigger validar_nombre_curso before insert or update of nombre, promocion_ciclo_id on public.cursos for each row execute function privado.evitar_nombres_repetidos();
