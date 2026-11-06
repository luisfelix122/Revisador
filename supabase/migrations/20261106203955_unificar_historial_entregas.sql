begin;
lock table public.examenes_estudiantes, public.historial_entregas_estudiantes in share row exclusive mode;

-- Solo se reconstruye una primera entrega cuya ruta activa es conocida.
do $$ begin
 if exists(select 1 from public.examenes_estudiantes e where not exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=e.id) and e.numero_entregas<>1) then
  raise exception 'Hay exámenes con varias entregas sin historial; revisar antes de migrar';
 end if;
 if exists(select 1 from public.examenes_estudiantes e where exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=e.id)
  and (not exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=e.id and h.numero_entrega=e.numero_entregas and h.ruta_archivo=e.ruta_imagen_examen)
    or exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=e.id and h.numero_entrega>e.numero_entregas))) then
  raise exception 'Hay entregas activas inconsistentes; revisar antes de migrar';
 end if;
end $$;
insert into public.historial_entregas_estudiantes(examen_estudiante_id,numero_entrega,ruta_archivo,creado_en,motivo_reenvio)
 select e.id,1,e.ruta_imagen_examen,coalesce(e.creado_en,now()),'Primera entrega reconstruida'
 from public.examenes_estudiantes e where not exists(select 1 from public.historial_entregas_estudiantes h where h.examen_estudiante_id=e.id);

-- Las nuevas cargas docentes comienzan con una entrada de historial real.
create function privado.registrar_primera_carga_docente() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ruta_imagen_examen not like 'estudiantes/%' then
  insert into public.historial_entregas_estudiantes(examen_estudiante_id,numero_entrega,ruta_archivo,creado_en,motivo_reenvio)
   values(new.id,1,new.ruta_imagen_examen,coalesce(new.creado_en,now()),'Carga docente');
 end if;
 return new;
end $$;
revoke all on function privado.registrar_primera_carga_docente() from public,anon,authenticated;
create trigger registrar_primera_carga_docente after insert on public.examenes_estudiantes for each row execute function privado.registrar_primera_carga_docente();

-- Ambas copias de la entrega activa deben corresponder a la última versión.
create function privado.comprobar_entrega_activa(p_examen uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_examen public.examenes_estudiantes; v_numero integer; v_ruta text;
begin
 select * into v_examen from public.examenes_estudiantes where id=p_examen for update;
 if not found then return; end if;
 select numero_entrega,ruta_archivo into v_numero,v_ruta from public.historial_entregas_estudiantes
  where examen_estudiante_id=p_examen order by numero_entrega desc limit 1;
 if v_numero is distinct from v_examen.numero_entregas or v_ruta is distinct from v_examen.ruta_imagen_examen then
  raise exception 'La entrega activa debe coincidir con la última versión del historial' using errcode='23514';
 end if;
end $$;
revoke all on function privado.comprobar_entrega_activa(uuid) from public,anon,authenticated;
create function privado.verificar_entrega_activa() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='examenes_estudiantes' then
  perform privado.comprobar_entrega_activa(new.id);
 else
  if tg_op <> 'INSERT' then perform privado.comprobar_entrega_activa(old.examen_estudiante_id); end if;
  if tg_op <> 'DELETE' and (tg_op='INSERT' or new.examen_estudiante_id is distinct from old.examen_estudiante_id) then
   perform privado.comprobar_entrega_activa(new.examen_estudiante_id);
  end if;
 end if;
 return null;
end $$;
revoke all on function privado.verificar_entrega_activa() from public,anon,authenticated;
create constraint trigger verificar_entrega_examen after insert or update on public.examenes_estudiantes
 deferrable initially deferred for each row execute function privado.verificar_entrega_activa();
create constraint trigger verificar_entrega_historial after insert or update or delete on public.historial_entregas_estudiantes
 deferrable initially deferred for each row execute function privado.verificar_entrega_activa();

create or replace function privado.guardar_resultado(p_examen uuid,p_resultado jsonb,p_intento uuid,p_revisado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_examen public.examenes_estudiantes; v_preguntas jsonb; v_total numeric; begin
 select * into v_examen from public.examenes_estudiantes where id=p_examen;
 perform privado.exigir_propiedad(v_examen.evaluacion_id);
 select * into v_examen from public.examenes_estudiantes where id=p_examen for update;
 if p_revisado then
   if v_examen.estado_revision<>'completado' then raise exception 'Primero califica el examen'; end if;
 elsif v_examen.estado_revision<>'procesando' or p_intento is distinct from v_examen.intento_id then raise exception 'Intento vencido'; end if;
 v_preguntas:=p_resultado->'preguntas';
 if jsonb_typeof(v_preguntas)<>'array' or jsonb_array_length(v_preguntas)<>(select count(*) from public.criterios_preguntas where evaluacion_id=v_examen.evaluacion_id) then raise exception 'Faltan preguntas'; end if;
 if exists(select 1 from jsonb_array_elements(v_preguntas) x where not exists(select 1 from public.criterios_preguntas c where c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int)) then raise exception 'Pregunta desconocida'; end if;
 if exists(select 1 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int
   where x->>'puntaje_obtenido' is null or (x->>'puntaje_obtenido')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
      or (x->>'puntaje_obtenido')::numeric <> trunc((x->>'puntaje_obtenido')::numeric,2)
      or (x->>'puntaje_obtenido')::numeric < 0 or (x->>'puntaje_obtenido')::numeric > c.puntaje_maximo) then
   raise exception 'Puntaje inválido: debe estar dentro del máximo y tener hasta dos decimales';
 end if;
 delete from public.detalles_preguntas where examen_estudiante_id=p_examen;
 insert into public.detalles_preguntas(examen_estudiante_id,numero_pregunta,puntaje_obtenido,puntaje_maximo,respuesta_detectada,justificacion)
 select p_examen,c.numero_pregunta,(x->>'puntaje_obtenido')::numeric,c.puntaje_maximo,coalesce(nullif(trim(x->>'respuesta_detectada'),''),'nada'),x->>'justificacion'
 from jsonb_array_elements(v_preguntas) x join public.criterios_preguntas c on c.evaluacion_id=v_examen.evaluacion_id and c.numero_pregunta=(x->>'numero_pregunta')::int;
 select sum(puntaje_obtenido) into v_total from public.detalles_preguntas where examen_estudiante_id=p_examen;
 update public.examenes_estudiantes set nombre_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.nombre_estudiante else coalesce(nullif(trim(p_resultado->>'nombre_estudiante'),''),'nada') end,codigo_estudiante=case when not p_revisado and v_examen.ruta_imagen_examen like 'estudiantes/%' then v_examen.codigo_estudiante else coalesce(nullif(trim(p_resultado->>'codigo_estudiante'),''),'nada') end,observaciones_generales=p_resultado->>'observaciones_generales',nota_final=v_total,estado_revision='completado',revisado_por_profesor=p_revisado,actualizado_en=now() where id=p_examen;
 if not exists(select 1 from public.examenes_estudiantes where evaluacion_id=v_examen.evaluacion_id and estado_revision<>'completado') then update public.evaluaciones set estado='calificado',actualizado_en=now() where id=v_examen.evaluacion_id; end if;
 return jsonb_build_object('guardado',true,'nota_final',v_total);
end
$$;

commit;
