begin;
-- Bloquea escrituras durante el inventario y la vinculación de datos existentes.
lock table public.evaluaciones, public.criterios_preguntas, public.examenes_estudiantes, public.detalles_preguntas in share row exclusive mode;

-- Una rúbrica versionada conserva los criterios disponibles al calificar.
create table privado.versiones_rubrica (
 id uuid primary key default gen_random_uuid(),
 evaluacion_id uuid not null references public.evaluaciones(id) on delete cascade,
 activa boolean not null default true,
 origen text not null default 'registrada' check (origen in ('registrada','reconstruida')),
 creada_en timestamptz not null default now()
);
create unique index versiones_rubrica_activa on privado.versiones_rubrica(evaluacion_id) where activa;
create table privado.criterios_versionados (
 id uuid primary key default gen_random_uuid(),
 version_rubrica_id uuid not null references privado.versiones_rubrica(id) on delete cascade,
 numero_pregunta integer not null check (numero_pregunta between 1 and 100),
 puntaje_maximo numeric(5,2) not null check (puntaje_maximo > 0 and puntaje_maximo <= 100),
 respuesta_esperada text not null,
 unique (version_rubrica_id,numero_pregunta)
);
revoke all on privado.versiones_rubrica, privado.criterios_versionados from public,anon,authenticated;

-- Si hay datos anteriores inconsistentes, detenerse en vez de inventar su rúbrica.
do $$ begin
 if exists (select 1 from public.detalles_preguntas d join public.examenes_estudiantes e on e.id=d.examen_estudiante_id
  left join public.criterios_preguntas c on c.evaluacion_id=e.evaluacion_id and c.numero_pregunta=d.numero_pregunta
  where c.id is null or c.puntaje_maximo is distinct from d.puntaje_maximo) then
  raise exception 'Hay detalles anteriores que requieren revisión antes de versionar la rúbrica';
 end if;
end $$;
insert into privado.versiones_rubrica(evaluacion_id,origen)
 select distinct evaluacion_id,'reconstruida' from public.criterios_preguntas;
insert into privado.criterios_versionados(version_rubrica_id,numero_pregunta,puntaje_maximo,respuesta_esperada)
 select v.id,c.numero_pregunta,c.puntaje_maximo,c.respuesta_esperada
 from public.criterios_preguntas c join privado.versiones_rubrica v on v.evaluacion_id=c.evaluacion_id and v.activa;
alter table public.detalles_preguntas add column criterio_versionado_id uuid;
update public.detalles_preguntas d set criterio_versionado_id=cv.id
 from public.examenes_estudiantes e, privado.versiones_rubrica v, privado.criterios_versionados cv
 where e.id=d.examen_estudiante_id and v.evaluacion_id=e.evaluacion_id and v.activa
 and cv.version_rubrica_id=v.id and cv.numero_pregunta=d.numero_pregunta and cv.puntaje_maximo=d.puntaje_maximo;
alter table public.detalles_preguntas alter column criterio_versionado_id set not null;
alter table public.detalles_preguntas add constraint detalles_criterio_versionado_fk
 foreign key (criterio_versionado_id) references privado.criterios_versionados(id) deferrable initially deferred;
create index detalles_criterio_versionado on public.detalles_preguntas(criterio_versionado_id);

-- Cada escritura de rúbrica crea una versión completa tras insertar sus criterios.
create function privado.versionar_rubrica_insertada() returns trigger language plpgsql security definer set search_path='' as $$
declare evaluacion record; version_id uuid;
begin
 for evaluacion in select distinct evaluacion_id from criterios_insertados order by evaluacion_id loop
  perform 1 from public.evaluaciones where id=evaluacion.evaluacion_id for update;
  update privado.versiones_rubrica set activa=false where evaluacion_id=evaluacion.evaluacion_id and activa;
  insert into privado.versiones_rubrica(evaluacion_id) values(evaluacion.evaluacion_id) returning id into version_id;
  insert into privado.criterios_versionados(version_rubrica_id,numero_pregunta,puntaje_maximo,respuesta_esperada)
   select version_id,numero_pregunta,puntaje_maximo,respuesta_esperada from public.criterios_preguntas where evaluacion_id=evaluacion.evaluacion_id;
 end loop;
 return null;
end $$;
revoke all on function privado.versionar_rubrica_insertada() from public,anon,authenticated;
create trigger versionar_rubrica_insertada after insert on public.criterios_preguntas
 referencing new table as criterios_insertados for each statement execute function privado.versionar_rubrica_insertada();

-- Al guardar una nota, el detalle queda asociado al criterio de la versión activa.
create function privado.vincular_criterio_versionado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select c.id into new.criterio_versionado_id
 from public.examenes_estudiantes e join privado.versiones_rubrica v on v.evaluacion_id=e.evaluacion_id and v.activa
 join privado.criterios_versionados c on c.version_rubrica_id=v.id and c.numero_pregunta=new.numero_pregunta and c.puntaje_maximo=new.puntaje_maximo
 where e.id=new.examen_estudiante_id;
 if new.criterio_versionado_id is null then raise exception 'El detalle no coincide con la rúbrica activa'; end if;
 return new;
end $$;
revoke all on function privado.vincular_criterio_versionado() from public,anon,authenticated;
create trigger vincular_criterio_versionado before insert or update of examen_estudiante_id, numero_pregunta, puntaje_maximo, criterio_versionado_id on public.detalles_preguntas for each row execute function privado.vincular_criterio_versionado();
commit;
