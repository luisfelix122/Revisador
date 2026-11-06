begin;
lock table public.examenes_estudiantes, public.detalles_preguntas in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.examenes_estudiantes e where e.nota_final is distinct from
  (select coalesce(sum(d.puntaje_obtenido),0) from public.detalles_preguntas d where d.examen_estudiante_id=e.id)) then
  raise exception 'Hay notas que no coinciden con sus detalles; revisarlas antes de aplicar la protección';
 end if;
end $$;

-- La comprobación se difiere hasta el final de la transacción: el guardado
-- reemplaza primero los detalles y luego actualiza la nota del examen.
create function privado.comprobar_nota_examen(p_examen uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_nota numeric; v_suma numeric;
begin
 select nota_final into v_nota from public.examenes_estudiantes where id=p_examen for update;
 if not found then return; end if;
 select coalesce(sum(puntaje_obtenido),0) into v_suma from public.detalles_preguntas where examen_estudiante_id=p_examen;
 if v_nota is distinct from v_suma then raise exception 'La nota final debe coincidir con la suma de sus preguntas' using errcode='23514'; end if;
end $$;
revoke all on function privado.comprobar_nota_examen(uuid) from public,anon,authenticated;
create function privado.verificar_nota_examen() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='examenes_estudiantes' then
  perform privado.comprobar_nota_examen(new.id);
 else
  if tg_op <> 'INSERT' then perform privado.comprobar_nota_examen(old.examen_estudiante_id); end if;
  if tg_op <> 'DELETE' and (tg_op='INSERT' or new.examen_estudiante_id is distinct from old.examen_estudiante_id) then
   perform privado.comprobar_nota_examen(new.examen_estudiante_id);
  end if;
 end if;
 return null;
end $$;
revoke all on function privado.verificar_nota_examen() from public,anon,authenticated;
create constraint trigger verificar_nota_examen after insert or update on public.examenes_estudiantes
 deferrable initially deferred for each row execute function privado.verificar_nota_examen();
create constraint trigger verificar_nota_detalle after insert or update or delete on public.detalles_preguntas
 deferrable initially deferred for each row execute function privado.verificar_nota_examen();

-- Los criterios históricos no se alteran; al editar la rúbrica se crea otra versión.
create function privado.impedir_cambio_criterio_versionado() returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'Un criterio histórico no se puede modificar' using errcode='55000'; end $$;
revoke all on function privado.impedir_cambio_criterio_versionado() from public,anon,authenticated;
create trigger impedir_cambio_criterio_versionado before update on privado.criterios_versionados
 for each row execute function privado.impedir_cambio_criterio_versionado();
commit;
