begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','aislamiento-a@example.invalid'),('22222222-2222-4222-8222-222222222222','aislamiento-b@example.invalid');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
insert into public.anios_academicos(id,anio) values('a1111111-1111-4111-8111-111111111111',2026);
insert into public.facultades(id,anio_academico_id,nombre) values('b1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Facultad sintética');
insert into public.escuelas(id,facultad_id,nombre) values('c1111111-1111-4111-8111-111111111111','b1111111-1111-4111-8111-111111111111','Escuela sintética');
insert into public.promociones_ciclos(id,escuela_id,denominacion) values('d1111111-1111-4111-8111-111111111111','c1111111-1111-4111-8111-111111111111','Ciclo sintético');
insert into public.cursos(id,promocion_ciclo_id,nombre) values('e1111111-1111-4111-8111-111111111111','d1111111-1111-4111-8111-111111111111','Curso sintético');
insert into public.evaluaciones(id,curso_id,titulo,puntaje_total_maximo) values('f1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111','Evaluación sintética',20);
select public.guardar_rubrica('f1111111-1111-4111-8111-111111111111','[{"numero_pregunta":1,"puntaje_maximo":20,"respuesta_esperada":"Respuesta sintética"}]');
do $$begin
 if (select count(*) from public.criterios_preguntas)<>1 then raise exception 'El profesor no ve sus criterios'; end if;
 begin
 perform public.guardar_rubrica('f1111111-1111-4111-8111-111111111111','[{"numero_pregunta":1,"puntaje_maximo":19,"respuesta_esperada":"incorrecta"}]');
 raise exception 'Se aceptó rúbrica con suma incorrecta';
 exception when raise_exception then if SQLERRM='Se aceptó rúbrica con suma incorrecta' then raise; end if; end;
 if (select puntaje_maximo from public.criterios_preguntas limit 1)<>20 then raise exception 'Una escritura fallida no fue atómica'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
insert into public.anios_academicos(anio) values(2026);
do $$begin
 if (select count(*) from public.anios_academicos)<>1 then raise exception 'Los años se filtran mal por profesor'; end if;
 if (select count(*) from public.evaluaciones)<>0 or (select count(*) from public.criterios_preguntas)<>0 then raise exception 'Se filtraron datos del otro profesor'; end if;
 begin
 perform public.guardar_rubrica('f1111111-1111-4111-8111-111111111111','[{"numero_pregunta":1,"puntaje_maximo":20,"respuesta_esperada":"ataque"}]');
 raise exception 'Se permitió mutación cruzada';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.facultades(anio_academico_id,nombre) values('a1111111-1111-4111-8111-111111111111','Ataque');
 raise exception 'Se permitió padre ajeno';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$begin
 if has_table_privilege('anon','public.criterios_preguntas','select') then raise exception 'Anónimo puede leer criterios'; end if;
 if has_function_privilege('anon','public.guardar_resultado(uuid,jsonb,uuid,boolean)','execute') then raise exception 'Anónimo ejecuta escritura de notas'; end if;
end $$;
rollback;
