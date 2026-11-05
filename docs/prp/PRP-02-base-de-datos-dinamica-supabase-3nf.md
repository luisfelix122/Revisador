# PRP-02: Base de Datos Relacional Dinámica en Supabase (3NF Estricta)

## 1. Objetivo y Regla de Oro
Diseñar la estructura de base de datos en **Supabase (PostgreSQL)** para la biblioteca académica y el sistema de calificaciones.
> **Regla Obligatoria**: Toda tabla y relación debe cumplir estrictamente como mínimo con la **Tercera Forma Normal (3NF)**. Queda prohibida la duplicidad de datos, campos compuestos o dependencias transitivas.

---

## 2. Dinamismo y Normalización (3NF)

El sistema debe permitir que el profesor cree y organice dinámicamente cualquier cantidad de niveles jerárquicos:
* Múltiples Años Académicos.
* Múltiples Facultades por Año.
* Múltiples Escuelas Profesionales por Facultad.
* Múltiples Promociones o Ciclos por Escuela.
* Múltiples Cursos por Ciclo.
* Múltiples Evaluaciones por Curso.
* Múltiples Materiales de Apoyo por Evaluación.
* Múltiples Exámenes de Alumnos por Evaluación.
* Múltiples Preguntas con desglose atómico por Examen.

### Justificación de 3NF:
1. **1NF (Atomicidad y Claves Primarias)**:
   - Cada tabla posee una clave primaria única (`UUID` generado por `gen_random_uuid()`).
   - Cada columna almacena un único valor atómico (no se almacenan listas de preguntas o arreglos de notas en una sola celda).
2. **2NF (Sin Dependencias Parciales)**:
   - Se cumple 1NF y todos los atributos no clave dependen al 100% de la clave primaria completa de la tabla.
3. **3NF (Sin Dependencias Transitivas)**:
   - Se cumple 2NF y ningún atributo no clave depende funcionalmente de otro atributo no clave. Por ejemplo, `evaluaciones` solo hace referencia a `curso_id`, y no almacena redundantemente el nombre de la escuela o la facultad.

---

## 3. Esquema DDL en Supabase (SQL en Español)

```sql
-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. AÑOS ACADÉMICOS
-- ============================================================================
CREATE TABLE anios_academicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_anio_academico UNIQUE (anio)
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
    puntaje_total_maximo NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    estado VARCHAR(50) NOT NULL DEFAULT 'borrador', -- 'borrador', 'calificado', 'publicado'
    token_recepcion UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    recepcion_abierta BOOLEAN NOT NULL DEFAULT true,
    tiempo_limite_minutos INT,
    fecha_cierre_programada TIMESTAMP WITH TIME ZONE,
    permitir_reenvios_global BOOLEAN NOT NULL DEFAULT false,
    cantidad_estudiantes_esperados INT DEFAULT NULL CHECK (cantidad_estudiantes_esperados IS NULL OR cantidad_estudiantes_esperados > 0),
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
    codigo_estudiante VARCHAR(100) NOT NULL DEFAULT 'nada',
    ruta_imagen_examen VARCHAR(500) NOT NULL,
    numero_entregas INT NOT NULL DEFAULT 1,
    permitir_reenvio BOOLEAN NOT NULL DEFAULT false,
    nota_final NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    observaciones_generales TEXT,
    estado_revision VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_evaluacion_codigo_unico 
ON examenes_estudiantes(evaluacion_id, lower(trim(codigo_estudiante)))
WHERE codigo_estudiante <> 'nada';

-- ============================================================================
-- 10. HISTORIAL INMUTABLE DE ENTREGAS (Auditoría 3NF)
-- ============================================================================
CREATE TABLE historial_entregas_estudiantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_estudiante_id UUID NOT NULL REFERENCES examenes_estudiantes(id) ON DELETE CASCADE,
    numero_entrega INT NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    motivo_reenvio TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_historial_examen_entrega UNIQUE (examen_estudiante_id, numero_entrega)
);

-- ============================================================================
-- 11. DETALLES POR PREGUNTA (Atómico en 3NF)
-- ============================================================================
CREATE TABLE detalles_preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_estudiante_id UUID NOT NULL REFERENCES examenes_estudiantes(id) ON DELETE CASCADE,
    numero_pregunta INT NOT NULL,
    puntaje_obtenido NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    puntaje_maximo NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    respuesta_detectada TEXT DEFAULT 'nada',
    justificacion TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
```

---

## 4. Dinamismo de Consultas
Para renderizar la biblioteca en cascada (árbol de navegación dinámico), las consultas se ejecutan de manera perezosa (*lazy loading* o consultas por nivel):
- `SELECT * FROM facultades WHERE anio_academico_id = :id;`
- `SELECT * FROM escuelas WHERE facultad_id = :id;`
- `SELECT * FROM promociones_ciclos WHERE escuela_id = :id;`
- `SELECT * FROM cursos WHERE promocion_ciclo_id = :id;`

Esto garantiza tiempos de respuesta instantáneos y cero consumo innecesario de ancho de banda.

---

## 5. Control de Aforo de Aula y Funciones Almacenadas (RPC) en 3NF

Para garantizar integridad relacional y concurrencia segura sin condiciones de carrera (*race conditions*) al recibir entregas masivas desde smartphones, se emplean funciones transaccionales en PostgreSQL:

1. **`registrar_entrega_estudiante(p_token, p_codigo, p_nombre, p_ruta_archivo)`**:
   - Valida el estado de recepción abierta y la vigencia temporal.
   - **Control de Aforo (`cantidad_estudiantes_esperados`)**:
     - Si el estudiante es nuevo y la cantidad de entregas actuales ya alcanzó el aforo (`COUNT(*) >= cantidad_estudiantes_esperados`), lanza excepción con código SQL `42301`, impidiendo que alumnos no presentes en el salón utilicen el enlace público.
     - Si el estudiante ya tiene un examen registrado y cuenta con autorización docente (`permitir_reenvio = true` o `permitir_reenvios_global = true`), se permite la actualización sin consumir un cupo adicional.
   - **Historial Inmutable (3NF)**: Inserta la nueva versión en `historial_entregas_estudiantes` con timestamp y número correlativo incrementado.

2. **`configurar_recepcion_docente(p_evaluacion_id, p_abierta, p_minutos_limite, p_reenvios_global, p_estudiantes_esperados)`**:
   - Permite al profesor abrir/cerrar entregas, definir tiempo límite, alternar reenvíos masivos y fijar/ampliar el aforo en tiempo real.

3. **`obtener_info_recepcion(p_token)`**:
   - Devuelve la jerarquía institucional (`Año` › `Facultad` › `Escuela` › `Curso`), el estado de recepción, el aforo configurado (`cantidad_estudiantes_esperados`), el total de entregas recibidas y el indicador booleano `cupo_alcanzado`.
