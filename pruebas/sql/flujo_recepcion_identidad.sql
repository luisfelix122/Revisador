begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','prueba-flujo@example.invalid');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.anios_academicos(id,anio,propietario_id) values('a1111111-1111-4111-8111-111111111111',2026,'11111111-1111-4111-8111-111111111111');
insert into public.facultades(id,anio_academico_id,nombre) values('b1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Facultad');
insert into public.escuelas(id,facultad_id,nombre) values('c1111111-1111-4111-8111-111111111111','b1111111-1111-4111-8111-111111111111','Escuela');
insert into public.promociones_ciclos(id,escuela_id,denominacion) values('d1111111-1111-4111-8111-111111111111','c1111111-1111-4111-8111-111111111111','Ciclo');
insert into public.cursos(id,promocion_ciclo_id,nombre) values('e1111111-1111-4111-8111-111111111111','d1111111-1111-4111-8111-111111111111','Curso');
insert into public.evaluaciones(id,curso_id,titulo,puntaje_total_maximo,token_recepcion) values('f1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111','Evaluación',20,'99999999-9999-4999-8999-999999999999');
insert into storage.objects(bucket_id,name) values
 ('evaluaciones','11111111-1111-4111-8111-111111111111/f1111111-1111-4111-8111-111111111111/manual.jpg'),
 ('evaluaciones','estudiantes/f1111111-1111-4111-8111-111111111111/estudiante.pdf'),
 ('evaluaciones','estudiantes/f1111111-1111-4111-8111-111111111111/reenvio.pdf');
set local role authenticated;
select public.guardar_rubrica('f1111111-1111-4111-8111-111111111111','[{"numero_pregunta":1,"puntaje_maximo":20,"respuesta_esperada":"A"}]');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  begin
    perform public.configurar_modalidad_recepcion('f1111111-1111-4111-8111-111111111111','manual',null);
    raise exception 'Se permitió modificar la evaluación de otro docente';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.configurar_modalidad_recepcion('f1111111-1111-4111-8111-111111111111','manual',null);
select public.registrar_archivo('f1111111-1111-4111-8111-111111111111','examen','manual.jpg','imagen','11111111-1111-4111-8111-111111111111/f1111111-1111-4111-8111-111111111111/manual.jpg',1);
do $$ declare resultado jsonb; begin
 resultado:=public.configurar_modalidad_recepcion('f1111111-1111-4111-8111-111111111111','alumnos',null);
 if (resultado->>'ok')::boolean then raise exception 'Cambio permitido antes de completar la carga manual'; end if;
 resultado:=public.configurar_modalidad_recepcion('f1111111-1111-4111-8111-111111111111','manual',true);
 if not (resultado->>'ok')::boolean then raise exception 'No se guardó confirmación'; end if;
 resultado:=public.configurar_modalidad_recepcion('f1111111-1111-4111-8111-111111111111','alumnos',null);
 if not (resultado->>'ok')::boolean then raise exception 'No se cambió la modalidad'; end if;
end $$;
select public.configurar_recepcion_docente('f1111111-1111-4111-8111-111111111111',true,30,false,10);
do $$ begin if not (select recepcion_iniciada from public.evaluaciones where id='f1111111-1111-4111-8111-111111111111') then raise exception 'No se registró la apertura'; end if; end $$;
reset role;
select public.registrar_entrega_estudiante('99999999-9999-4999-8999-999999999999','Ana Estudiante','COD-001','estudiantes/f1111111-1111-4111-8111-111111111111/estudiante.pdf');
do $$ declare v_examen uuid; v_manual uuid; intento jsonb; resultado jsonb; begin
 select id into v_examen from public.examenes_estudiantes where codigo_estudiante='COD-001';
 select id into v_manual from public.examenes_estudiantes where ruta_imagen_examen like '%/manual.jpg';
 intento:=public.iniciar_examen(v_examen);
 resultado:=public.guardar_resultado(v_examen,'{"nombre_estudiante":"nada","codigo_estudiante":"nada","observaciones_generales":"","preguntas":[{"numero_pregunta":1,"puntaje_obtenido":10,"respuesta_detectada":"A","justificacion":"Correcta"}]}',(intento->>'intento')::uuid,false);
 if not exists(select 1 from public.examenes_estudiantes where id=v_examen and nombre_estudiante='Ana Estudiante' and codigo_estudiante='COD-001') then raise exception 'La IA modificó la identidad entregada'; end if;
 intento:=public.iniciar_examen(v_manual);
 perform public.guardar_resultado(v_manual,'{"nombre_estudiante":"Docente Manual","codigo_estudiante":"M-1","observaciones_generales":"","preguntas":[{"numero_pregunta":1,"puntaje_obtenido":10,"respuesta_detectada":"A","justificacion":"Correcta"}]}',(intento->>'intento')::uuid,false);
 if not exists(select 1 from public.examenes_estudiantes where id=v_manual and codigo_estudiante='M-1') then raise exception 'Carga manual perdió identificación de IA'; end if;
 perform public.guardar_resultado(v_examen,'{"nombre_estudiante":"Ana Corregida","codigo_estudiante":"COD-001","observaciones_generales":"","preguntas":[{"numero_pregunta":1,"puntaje_obtenido":10,"respuesta_detectada":"A","justificacion":"Correcta"}]}',null,true);
 if not exists(select 1 from public.examenes_estudiantes where id=v_examen and nombre_estudiante='Ana Corregida') then raise exception 'El docente no pudo corregir identidad'; end if;
 perform public.permitir_reenvio_estudiante(v_examen,true);
 resultado:=public.registrar_entrega_estudiante('99999999-9999-4999-8999-999999999999','Ana Corregida','COD-001','estudiantes/f1111111-1111-4111-8111-111111111111/reenvio.pdf');
 if (resultado->>'numero_entrega')::int<>2 then raise exception 'El reenvío no conserva el código'; end if;
end $$;
rollback;
