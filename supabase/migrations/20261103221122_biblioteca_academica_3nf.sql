-- Habilitar extensión para UUIDs
-- gen_random_uuid() es nativo en PostgreSQL moderno.

-- ============================================================================
-- 1. AÑOS ACADÉMICOS
-- ============================================================================
CREATE TABLE anios_academicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio INT NOT NULL CHECK (anio BETWEEN 1900 AND 2200),
    propietario_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_anio_academico UNIQUE (propietario_id, anio)
);

-- ============================================================================
-- 2. FACULTADES
-- ============================================================================
CREATE TABLE facultades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio_academico_id UUID NOT NULL REFERENCES anios_academicos(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_facultad_por_anio UNIQUE (anio_academico_id, nombre)
);

-- ============================================================================
-- 3. ESCUELAS PROFESIONALES
-- ============================================================================
CREATE TABLE escuelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facultad_id UUID NOT NULL REFERENCES facultades(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_escuela_por_facultad UNIQUE (facultad_id, nombre)
);

-- ============================================================================
-- 4. PROMOCIONES O CICLOS ACADÉMICOS
-- ============================================================================
CREATE TABLE promociones_ciclos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escuela_id UUID NOT NULL REFERENCES escuelas(id) ON DELETE CASCADE,
    denominacion VARCHAR(100) NOT NULL, -- Ej: 'Ciclo 2026-I', 'Promoción 2022'
    periodo VARCHAR(50),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_promocion_por_escuela UNIQUE (escuela_id, denominacion)
);

-- ============================================================================
-- 5. CURSOS
-- ============================================================================
CREATE TABLE cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promocion_ciclo_id UUID NOT NULL REFERENCES promociones_ciclos(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    codigo_asignatura VARCHAR(50),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_curso_por_promocion UNIQUE (promocion_ciclo_id, nombre)
);

-- ============================================================================
-- 6. EVALUACIONES
-- ============================================================================
CREATE TABLE evaluaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL, -- Ej: 'Examen Parcial', 'Práctica 2'
    indicaciones_profesor TEXT, -- Directrices libres ingresadas por el docente
    puntaje_total_maximo NUMERIC(5, 2) NOT NULL DEFAULT 20.00 CHECK (puntaje_total_maximo > 0),
    estado VARCHAR(50) NOT NULL DEFAULT 'borrador', -- 'borrador', 'calificado', 'publicado'
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. SOLUCIONES OFICIALES DEL PROFESOR (1 a 1 con Evaluación)
-- ============================================================================
CREATE TABLE soluciones_profesor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluacion_id UUID NOT NULL UNIQUE REFERENCES evaluaciones(id) ON DELETE CASCADE,
    tipo_archivo VARCHAR(50) NOT NULL, -- 'imagen', 'pdf', 'word'
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    contenido_texto_extraido TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 8. MATERIALES DE APOYO COMPLEMENTARIOS (1 a N con Evaluación)
-- ============================================================================
CREATE TABLE materiales_apoyo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluacion_id UUID NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL, -- 'pdf', 'word', 'imagen', 'texto'
    ruta_almacenamiento VARCHAR(500) NOT NULL,
    descripcion VARCHAR(500),
    contenido_texto_extraido TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 9. EXÁMENES DE ESTUDIANTES
-- ============================================================================
CREATE TABLE examenes_estudiantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluacion_id UUID NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
    nombre_estudiante VARCHAR(255) NOT NULL DEFAULT 'nada',
    codigo_estudiante VARCHAR(100) DEFAULT 'nada',
    ruta_imagen_examen VARCHAR(500) NOT NULL,
    nota_final NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    observaciones_generales TEXT,
    estado_revision VARCHAR(50) NOT NULL DEFAULT 'completado',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 10. DETALLES POR PREGUNTA (Atómico en 3NF)
-- ============================================================================
CREATE TABLE detalles_preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_estudiante_id UUID NOT NULL REFERENCES examenes_estudiantes(id) ON DELETE CASCADE,
    numero_pregunta INT NOT NULL CHECK (numero_pregunta > 0),
    puntaje_obtenido NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    puntaje_maximo NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    respuesta_detectada TEXT DEFAULT 'nada',
    justificacion TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT ck_puntajes CHECK (puntaje_maximo >= 0 AND puntaje_maximo < 'Infinity'::numeric AND puntaje_obtenido BETWEEN 0 AND puntaje_maximo),
    CONSTRAINT ck_respuesta_vacia CHECK (respuesta_detectada <> 'nada' OR puntaje_obtenido = 0),
    CONSTRAINT uq_detalle_examen_pregunta UNIQUE (examen_estudiante_id, numero_pregunta)
);

-- ============================================================================
-- ÍNDICES PARA OPTIMIZAR NAVEGACIÓN TIPO BIBLIOTECA
-- ============================================================================
CREATE INDEX idx_facultades_anio ON facultades(anio_academico_id);
CREATE INDEX idx_escuelas_facultad ON escuelas(facultad_id);
CREATE INDEX idx_promociones_escuela ON promociones_ciclos(escuela_id);
CREATE INDEX idx_cursos_promocion ON cursos(promocion_ciclo_id);
CREATE INDEX idx_evaluaciones_curso ON evaluaciones(curso_id);
CREATE INDEX idx_materiales_evaluacion ON materiales_apoyo(evaluacion_id);
CREATE INDEX idx_examenes_evaluacion ON examenes_estudiantes(evaluacion_id);
CREATE INDEX idx_detalles_examen ON detalles_preguntas(examen_estudiante_id);

-- Aislamiento de profesores en la raíz, sin repetir propietario en descendientes.
ALTER TABLE public.anios_academicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anios_academicos FROM anon;
GRANT SELECT ON public.anios_academicos TO authenticated;
CREATE POLICY "leer_propios" ON public.anios_academicos FOR SELECT TO authenticated USING ((select auth.uid()) = propietario_id);
GRANT INSERT, UPDATE, DELETE ON public.anios_academicos TO authenticated;
CREATE POLICY "crear_propios" ON public.anios_academicos FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = propietario_id);
CREATE POLICY "editar_propios" ON public.anios_academicos FOR UPDATE TO authenticated USING ((select auth.uid()) = propietario_id) WITH CHECK ((select auth.uid()) = propietario_id);
CREATE POLICY "borrar_propios" ON public.anios_academicos FOR DELETE TO authenticated USING ((select auth.uid()) = propietario_id);
ALTER TABLE public.facultades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.facultades FROM anon;
GRANT SELECT ON public.facultades TO authenticated;
CREATE POLICY "leer_propios" ON public.facultades FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.anios_academicos AS padre WHERE padre.id = facultades.anio_academico_id));
GRANT INSERT, UPDATE, DELETE ON public.facultades TO authenticated;
CREATE POLICY "crear_propios" ON public.facultades FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.anios_academicos AS padre WHERE padre.id = facultades.anio_academico_id));
CREATE POLICY "editar_propios" ON public.facultades FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.anios_academicos AS padre WHERE padre.id = facultades.anio_academico_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.anios_academicos AS padre WHERE padre.id = facultades.anio_academico_id));
CREATE POLICY "borrar_propios" ON public.facultades FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.anios_academicos AS padre WHERE padre.id = facultades.anio_academico_id));
ALTER TABLE public.escuelas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escuelas FROM anon;
GRANT SELECT ON public.escuelas TO authenticated;
CREATE POLICY "leer_propios" ON public.escuelas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.facultades AS padre WHERE padre.id = escuelas.facultad_id));
GRANT INSERT, UPDATE, DELETE ON public.escuelas TO authenticated;
CREATE POLICY "crear_propios" ON public.escuelas FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.facultades AS padre WHERE padre.id = escuelas.facultad_id));
CREATE POLICY "editar_propios" ON public.escuelas FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.facultades AS padre WHERE padre.id = escuelas.facultad_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.facultades AS padre WHERE padre.id = escuelas.facultad_id));
CREATE POLICY "borrar_propios" ON public.escuelas FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.facultades AS padre WHERE padre.id = escuelas.facultad_id));
ALTER TABLE public.promociones_ciclos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promociones_ciclos FROM anon;
GRANT SELECT ON public.promociones_ciclos TO authenticated;
CREATE POLICY "leer_propios" ON public.promociones_ciclos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.escuelas AS padre WHERE padre.id = promociones_ciclos.escuela_id));
GRANT INSERT, UPDATE, DELETE ON public.promociones_ciclos TO authenticated;
CREATE POLICY "crear_propios" ON public.promociones_ciclos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.escuelas AS padre WHERE padre.id = promociones_ciclos.escuela_id));
CREATE POLICY "editar_propios" ON public.promociones_ciclos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.escuelas AS padre WHERE padre.id = promociones_ciclos.escuela_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.escuelas AS padre WHERE padre.id = promociones_ciclos.escuela_id));
CREATE POLICY "borrar_propios" ON public.promociones_ciclos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.escuelas AS padre WHERE padre.id = promociones_ciclos.escuela_id));
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cursos FROM anon;
GRANT SELECT ON public.cursos TO authenticated;
CREATE POLICY "leer_propios" ON public.cursos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.promociones_ciclos AS padre WHERE padre.id = cursos.promocion_ciclo_id));
GRANT INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
CREATE POLICY "crear_propios" ON public.cursos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.promociones_ciclos AS padre WHERE padre.id = cursos.promocion_ciclo_id));
CREATE POLICY "editar_propios" ON public.cursos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.promociones_ciclos AS padre WHERE padre.id = cursos.promocion_ciclo_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.promociones_ciclos AS padre WHERE padre.id = cursos.promocion_ciclo_id));
CREATE POLICY "borrar_propios" ON public.cursos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.promociones_ciclos AS padre WHERE padre.id = cursos.promocion_ciclo_id));
ALTER TABLE public.evaluaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evaluaciones FROM anon;
GRANT SELECT ON public.evaluaciones TO authenticated;
CREATE POLICY "leer_propios" ON public.evaluaciones FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.cursos AS padre WHERE padre.id = evaluaciones.curso_id));
GRANT INSERT, UPDATE, DELETE ON public.evaluaciones TO authenticated;
CREATE POLICY "crear_propios" ON public.evaluaciones FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.cursos AS padre WHERE padre.id = evaluaciones.curso_id));
CREATE POLICY "editar_propios" ON public.evaluaciones FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.cursos AS padre WHERE padre.id = evaluaciones.curso_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.cursos AS padre WHERE padre.id = evaluaciones.curso_id));
CREATE POLICY "borrar_propios" ON public.evaluaciones FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.cursos AS padre WHERE padre.id = evaluaciones.curso_id));
ALTER TABLE public.soluciones_profesor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soluciones_profesor FROM anon;
GRANT SELECT ON public.soluciones_profesor TO authenticated;
CREATE POLICY "leer_propios" ON public.soluciones_profesor FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluaciones AS padre WHERE padre.id = soluciones_profesor.evaluacion_id));
REVOKE INSERT, UPDATE, DELETE ON public.soluciones_profesor FROM authenticated;
ALTER TABLE public.materiales_apoyo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.materiales_apoyo FROM anon;
GRANT SELECT ON public.materiales_apoyo TO authenticated;
CREATE POLICY "leer_propios" ON public.materiales_apoyo FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluaciones AS padre WHERE padre.id = materiales_apoyo.evaluacion_id));
REVOKE INSERT, UPDATE, DELETE ON public.materiales_apoyo FROM authenticated;
ALTER TABLE public.examenes_estudiantes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.examenes_estudiantes FROM anon;
GRANT SELECT ON public.examenes_estudiantes TO authenticated;
CREATE POLICY "leer_propios" ON public.examenes_estudiantes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.evaluaciones AS padre WHERE padre.id = examenes_estudiantes.evaluacion_id));
REVOKE INSERT, UPDATE, DELETE ON public.examenes_estudiantes FROM authenticated;
ALTER TABLE public.detalles_preguntas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.detalles_preguntas FROM anon;
GRANT SELECT ON public.detalles_preguntas TO authenticated;
CREATE POLICY "leer_propios" ON public.detalles_preguntas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.examenes_estudiantes AS padre WHERE padre.id = detalles_preguntas.examen_estudiante_id));
REVOKE INSERT, UPDATE, DELETE ON public.detalles_preguntas FROM authenticated;

-- Resultados y archivos: escritura denegada hasta implementar persistencia transaccional.
