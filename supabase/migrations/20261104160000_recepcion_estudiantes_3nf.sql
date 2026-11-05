-- ============================================================================
-- MIGRACIÓN: RECEPCIÓN DE ALUMNOS, CONTROL DE DUPLICADOS E HISTORIAL INMUTABLE (3NF)
-- ============================================================================

-- 1. Campos de recepción en evaluaciones
ALTER TABLE public.evaluaciones
    ADD COLUMN IF NOT EXISTS token_recepcion UUID DEFAULT gen_random_uuid() NOT NULL,
    ADD COLUMN IF NOT EXISTS recepcion_abierta BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS tiempo_limite_minutos INT DEFAULT NULL CHECK (tiempo_limite_minutos IS NULL OR tiempo_limite_minutos > 0),
    ADD COLUMN IF NOT EXISTS fecha_cierre_programada TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS permitir_reenvios_global BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS cantidad_estudiantes_esperados INT DEFAULT NULL CHECK (cantidad_estudiantes_esperados IS NULL OR cantidad_estudiantes_esperados > 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_evaluaciones_token_recepcion ON public.evaluaciones(token_recepcion);

-- 2. Campos de control en examenes_estudiantes
ALTER TABLE public.examenes_estudiantes
    ADD COLUMN IF NOT EXISTS numero_entregas INT DEFAULT 1 NOT NULL CHECK (numero_entregas >= 1),
    ADD COLUMN IF NOT EXISTS permitir_reenvio BOOLEAN DEFAULT FALSE NOT NULL;

-- Restricción única para evitar duplicados del mismo alumno en la misma evaluación
CREATE UNIQUE INDEX IF NOT EXISTS uq_examen_estudiante_codigo 
    ON public.examenes_estudiantes(evaluacion_id, lower(trim(codigo_estudiante)))
    WHERE codigo_estudiante IS NOT NULL AND trim(codigo_estudiante) <> '' AND lower(trim(codigo_estudiante)) <> 'nada';

-- 3. Tabla histórica inmutable para auditoría de versiones entregadas
CREATE TABLE IF NOT EXISTS public.historial_entregas_estudiantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_estudiante_id UUID NOT NULL REFERENCES public.examenes_estudiantes(id) ON DELETE CASCADE,
    numero_entrega INT NOT NULL CHECK (numero_entrega >= 1),
    ruta_archivo VARCHAR(500) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    motivo_reenvio VARCHAR(255) DEFAULT 'Reenvío autorizado por docente',
    CONSTRAINT uq_historial_examen_entrega UNIQUE (examen_estudiante_id, numero_entrega)
);

CREATE INDEX IF NOT EXISTS idx_historial_examen ON public.historial_entregas_estudiantes(examen_estudiante_id);

-- RLS en historial
ALTER TABLE public.historial_entregas_estudiantes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.historial_entregas_estudiantes TO authenticated;
CREATE POLICY leer_historial_propio ON public.historial_entregas_estudiantes
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.examenes_estudiantes ee
        JOIN public.evaluaciones e ON e.id = ee.evaluacion_id
        WHERE ee.id = examen_estudiante_id
    ));

-- 4. Funciones de acceso seguro

-- Función pública para que el alumno obtenga datos básicos de la evaluación
CREATE OR REPLACE FUNCTION public.obtener_info_recepcion(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_eval RECORD;
BEGIN
    SELECT 
        e.id,
        e.titulo,
        e.indicaciones_profesor,
        e.puntaje_total_maximo,
        e.recepcion_abierta,
        e.tiempo_limite_minutos,
        e.fecha_cierre_programada,
        e.permitir_reenvios_global,
        e.cantidad_estudiantes_esperados,
        (SELECT COUNT(*) FROM public.examenes_estudiantes ee WHERE ee.evaluacion_id = e.id) AS total_entregados,
        c.nombre AS curso_nombre,
        f.nombre AS facultad_nombre,
        esc.nombre AS escuela_nombre,
        a.anio AS anio_academico
    INTO v_eval
    FROM public.evaluaciones e
    JOIN public.cursos c ON c.id = e.curso_id
    JOIN public.promociones_ciclos pc ON pc.id = c.promocion_ciclo_id
    JOIN public.escuelas esc ON esc.id = pc.escuela_id
    JOIN public.facultades f ON f.id = esc.facultad_id
    JOIN public.anios_academicos a ON a.id = f.anio_academico_id
    WHERE e.token_recepcion = p_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Evaluación no encontrada' USING errcode = '40400';
    END IF;

    -- Verificar si el tiempo programado expiró
    IF v_eval.recepcion_abierta AND v_eval.fecha_cierre_programada IS NOT NULL AND NOW() > v_eval.fecha_cierre_programada THEN
        UPDATE public.evaluaciones SET recepcion_abierta = FALSE WHERE id = v_eval.id;
        v_eval.recepcion_abierta := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'evaluacion_id', v_eval.id,
        'titulo', v_eval.titulo,
        'curso', v_eval.curso_nombre,
        'facultad', v_eval.facultad_nombre,
        'escuela', v_eval.escuela_nombre,
        'anio', v_eval.anio_academico,
        'puntaje_maximo', v_eval.puntaje_total_maximo,
        'recepcion_abierta', v_eval.recepcion_abierta,
        'fecha_cierre', v_eval.fecha_cierre_programada,
        'permitir_reenvios_global', v_eval.permitir_reenvios_global,
        'cantidad_estudiantes_esperados', v_eval.cantidad_estudiantes_esperados,
        'total_entregados', v_eval.total_entregados,
        'cupo_alcanzado', (v_eval.cantidad_estudiantes_esperados IS NOT NULL AND v_eval.total_entregados >= v_eval.cantidad_estudiantes_esperados)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_info_recepcion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_info_recepcion(UUID) TO anon, authenticated;

-- Función pública para registrar entrega del estudiante
CREATE OR REPLACE FUNCTION public.registrar_entrega_estudiante(
    p_token UUID,
    p_nombre TEXT,
    p_codigo TEXT,
    p_ruta TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_eval RECORD;
    v_examen RECORD;
    v_examen_id UUID;
    v_numero_entrega INT;
    v_nombre_limpio TEXT;
    v_codigo_limpio TEXT;
BEGIN
    v_nombre_limpio := COALESCE(NULLIF(trim(p_nombre), ''), 'nada');
    v_codigo_limpio := COALESCE(NULLIF(trim(p_codigo), ''), 'nada');

    IF v_codigo_limpio = 'nada' THEN
        RAISE EXCEPTION 'El código de estudiante es obligatorio para la entrega' USING errcode = '42200';
    END IF;

    SELECT id, recepcion_abierta, fecha_cierre_programada, permitir_reenvios_global, cantidad_estudiantes_esperados
    INTO v_eval
    FROM public.evaluaciones
    WHERE token_recepcion = p_token;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Evaluación no encontrada' USING errcode = '40400';
    END IF;

    -- Validar si está abierta y dentro del tiempo límite
    IF NOT v_eval.recepcion_abierta OR (v_eval.fecha_cierre_programada IS NOT NULL AND NOW() > v_eval.fecha_cierre_programada) THEN
        RAISE EXCEPTION 'La recepción de entregas para esta evaluación se encuentra cerrada.' USING errcode = '42300';
    END IF;

    -- Verificar si el alumno ya realizó una entrega previa
    SELECT * INTO v_examen
    FROM public.examenes_estudiantes
    WHERE evaluacion_id = v_eval.id AND lower(trim(codigo_estudiante)) = lower(v_codigo_limpio);

    IF FOUND THEN
        -- Si ya existe entrega, verificar si tiene permiso de reenvío
        IF NOT (v_examen.permitir_reenvio OR v_eval.permitir_reenvios_global) THEN
            RAISE EXCEPTION 'Ya has realizado una entrega. Solicita autorización a tu docente para volver a subir tu examen.' USING errcode = '40900';
        END IF;

        v_numero_entrega := v_examen.numero_entregas + 1;

        -- Actualizar registro activo
        UPDATE public.examenes_estudiantes
        SET ruta_imagen_examen = p_ruta,
            nombre_estudiante = v_nombre_limpio,
            numero_entregas = v_numero_entrega,
            permitir_reenvio = FALSE,
            estado_revision = 'pendiente',
            actualizado_en = NOW()
        WHERE id = v_examen.id;

        v_examen_id := v_examen.id;
    ELSE
        -- Validar si se ha alcanzado la cantidad de estudiantes esperados en aula
        IF v_eval.cantidad_estudiantes_esperados IS NOT NULL AND 
           (SELECT COUNT(*) FROM public.examenes_estudiantes WHERE evaluacion_id = v_eval.id) >= v_eval.cantidad_estudiantes_esperados THEN
            RAISE EXCEPTION 'Se ha alcanzado el límite de estudiantes esperados (% alumnos) para este examen. Si estás en el aula, consulta con tu docente.' 
                USING errcode = '42301';
        END IF;

        -- Primera entrega
        v_numero_entrega := 1;
        INSERT INTO public.examenes_estudiantes(
            evaluacion_id,
            nombre_estudiante,
            codigo_estudiante,
            ruta_imagen_examen,
            numero_entregas,
            estado_revision,
            observaciones_generales
        ) VALUES (
            v_eval.id,
            v_nombre_limpio,
            v_codigo_limpio,
            p_ruta,
            1,
            'pendiente',
            ''
        ) RETURNING id INTO v_examen_id;
    END IF;

    -- Registrar copia inmutable en el historial
    INSERT INTO public.historial_entregas_estudiantes(
        examen_estudiante_id,
        numero_entrega,
        ruta_archivo,
        creado_en
    ) VALUES (
        v_examen_id,
        v_numero_entrega,
        p_ruta,
        NOW()
    );

    RETURN jsonb_build_object(
        'examen_id', v_examen_id,
        'numero_entrega', v_numero_entrega,
        'codigo_estudiante', v_codigo_limpio,
        'nombre_estudiante', v_nombre_limpio,
        'entregado_en', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrega_estudiante(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_estudiante(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Función docente para cambiar estado de recepción (abrir/cerrar/reabrir/tiempo)
CREATE OR REPLACE FUNCTION public.configurar_recepcion_docente(
    p_evaluacion UUID,
    p_abierta BOOLEAN,
    p_tiempo_minutos INT,
    p_reenvios_global BOOLEAN,
    p_estudiantes_esperados INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_fecha_cierre TIMESTAMP WITH TIME ZONE;
BEGIN
    PERFORM privado.exigir_propiedad(p_evaluacion);

    IF p_abierta AND p_tiempo_minutos IS NOT NULL AND p_tiempo_minutos > 0 THEN
        v_fecha_cierre := NOW() + (p_tiempo_minutos || ' minutes')::INTERVAL;
    ELSE
        v_fecha_cierre := NULL;
    END IF;

    UPDATE public.evaluaciones
    SET recepcion_abierta = p_abierta,
        tiempo_limite_minutos = p_tiempo_minutos,
        fecha_cierre_programada = v_fecha_cierre,
        permitir_reenvios_global = p_reenvios_global,
        cantidad_estudiantes_esperados = p_estudiantes_esperados,
        actualizado_en = NOW()
    WHERE id = p_evaluacion;

    RETURN jsonb_build_object(
        'recepcion_abierta', p_abierta,
        'tiempo_limite_minutos', p_tiempo_minutos,
        'fecha_cierre_programada', v_fecha_cierre,
        'permitir_reenvios_global', p_reenvios_global,
        'cantidad_estudiantes_esperados', p_estudiantes_esperados
    );
END;
$$;

REVOKE ALL ON FUNCTION public.configurar_recepcion_docente(UUID, BOOLEAN, INT, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configurar_recepcion_docente(UUID, BOOLEAN, INT, BOOLEAN, INT) TO authenticated;

-- Función docente para autorizar reenvío individual a un estudiante
CREATE OR REPLACE FUNCTION public.permitir_reenvio_estudiante(
    p_examen UUID,
    p_permitir BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_eval_id UUID;
BEGIN
    SELECT evaluacion_id INTO v_eval_id
    FROM public.examenes_estudiantes
    WHERE id = p_examen;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Examen no encontrado' USING errcode = '40400';
    END IF;

    PERFORM privado.exigir_propiedad(v_eval_id);

    UPDATE public.examenes_estudiantes
    SET permitir_reenvio = p_permitir,
        actualizado_en = NOW()
    WHERE id = p_examen;

    RETURN jsonb_build_object('examen_id', p_examen, 'permitir_reenvio', p_permitir);
END;
$$;

REVOKE ALL ON FUNCTION public.permitir_reenvio_estudiante(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permitir_reenvio_estudiante(UUID, BOOLEAN) TO authenticated;

-- Función docente para reiniciar un examen y permitir re-evaluarlo
CREATE OR REPLACE FUNCTION public.reiniciar_examen(
    p_examen UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_eval_id UUID;
BEGIN
    SELECT evaluacion_id INTO v_eval_id
    FROM public.examenes_estudiantes
    WHERE id = p_examen;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Examen no encontrado' USING errcode = '40400';
    END IF;

    PERFORM privado.exigir_propiedad(v_eval_id);

    UPDATE public.examenes_estudiantes
    SET estado_revision = 'pendiente',
        intento_id = NULL,
        actualizado_en = NOW()
    WHERE id = p_examen;

    UPDATE public.evaluaciones
    SET estado = 'borrador',
        actualizado_en = NOW()
    WHERE id = v_eval_id;

    RETURN jsonb_build_object('ok', true, 'examen_id', p_examen);
END;
$$;

REVOKE ALL ON FUNCTION public.reiniciar_examen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reiniciar_examen(UUID) TO authenticated;

