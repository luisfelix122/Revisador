# PRP-01: Especificación del Sistema de Calificación de Exámenes y Biblioteca Académica

## 1. Resumen Ejecutivo
El sistema es una aplicación web diseñada para profesores que permite automatizar la corrección y calificación de exámenes de alumnos subidos como imágenes, comparándolos contra la solución oficial del docente (subida en formato imagen, PDF o Word), considerando materiales de apoyo complementarios (PDF, Word, imágenes) e indicaciones libres en texto.

El sistema es **agnóstico respecto a la IA**: cuenta con una sección de configuración donde el profesor introduce su API Key, selecciona el modelo correspondiente y verifica la conexión mediante un botón **"Comprobar"**, el cual muestra un **check visual de confirmación** si la API es válida. Además, incluye una **Calculadora de Costos** para estimar el costo de la evaluación antes de procesarla.

Los resultados se visualizan en una tabla detallada con retroalimentación explicativa ("el por qué" de cada nota) y pueden exportarse a un archivo de hoja de cálculo Excel (`.xlsx`). La información se organiza de forma jerárquica en una biblioteca académica persistida en **Supabase** bajo un esquema relacional normalizado en **Tercera Forma Normal (3NF)**.

---

## 2. Modelo Relacional en Supabase (Mínimo 3NF)

Cumplimiento estricto de **Tercera Forma Normal (3NF)**:
1. **1NF**: Columnas atómicas, claves primarias únicas (`UUID`), sin arrays o listas repetitivas desnormalizadas.
2. **2NF**: Cumple 1NF y no hay dependencias parciales de clave.
3. **3NF**: Cumple 2NF y no existen dependencias transitivas entre atributos no clave.

### Diagrama Entidad-Relación:

```
[anios_academicos]
       │ 1:N
       ▼
  [facultades]
       │ 1:N
       ▼
   [escuelas]
       │ 1:N
       ▼
[promociones_ciclos]
       │ 1:N
       ▼
    [cursos]
       │ 1:N
       ▼
 [evaluaciones] ──────────────┬────────────── 1:1 ──► [soluciones_profesor]
       │ 1:N                  │
       │                      └────────────── 1:N ──► [materiales_apoyo]
       ▼
[examenes_estudiantes]
       │ 1:N
       ▼
[detalles_preguntas]
```

### Definición de Tablas (DDL en Español):

```sql
-- 1. Años Académicos
CREATE TABLE anios_academicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio INT NOT NULL UNIQUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Facultades
CREATE TABLE facultades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio_academico_id UUID NOT NULL REFERENCES anios_academicos(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_facultad_anio UNIQUE (anio_academico_id, nombre)
);

-- 3. Escuelas Profesionales
CREATE TABLE escuelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facultad_id UUID NOT NULL REFERENCES facultades(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_escuela_facultad UNIQUE (facultad_id, nombre)
);

-- 4. Promociones o Ciclos
CREATE TABLE promociones_ciclos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escuela_id UUID NOT NULL REFERENCES escuelas(id) ON DELETE CASCADE,
    denominacion VARCHAR(100) NOT NULL, -- Ej: 'Ciclo 2026-I' o 'Promoción 2022'
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_promocion_escuela UNIQUE (escuela_id, denominacion)
);

-- 5. Cursos
CREATE TABLE cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promocion_ciclo_id UUID NOT NULL REFERENCES promociones_ciclos(id) ON DELETE CASCADE,
    codigo VARCHAR(50),
    nombre VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_curso_promocion UNIQUE (promocion_ciclo_id, nombre)
);

-- 6. Evaluaciones
CREATE TABLE evaluaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL, -- Ej: 'Examen Parcial', 'Práctica Calificada 1'
    indicaciones_profesor TEXT, -- Cuadro de texto libre con directrices
    puntaje_total_maximo NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    token_recepcion UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    recepcion_abierta BOOLEAN NOT NULL DEFAULT true,
    tiempo_limite_minutos INT,
    fecha_cierre_programada TIMESTAMP WITH TIME ZONE,
    permitir_reenvios_global BOOLEAN NOT NULL DEFAULT false,
    cantidad_estudiantes_esperados INT DEFAULT NULL CHECK (cantidad_estudiantes_esperados IS NULL OR cantidad_estudiantes_esperados > 0),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Solución Oficial del Profesor (1 a 1 con Evaluación)
CREATE TABLE soluciones_profesor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluacion_id UUID NOT NULL UNIQUE REFERENCES evaluaciones(id) ON DELETE CASCADE,
    tipo_archivo VARCHAR(50) NOT NULL, -- 'imagen', 'pdf', 'word'
    ruta_archivo VARCHAR(500) NOT NULL,
    criterios_extraidos JSONB, -- Puntos por pregunta y respuestas esperadas
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Materiales de Apoyo Complementarios (1 a N con Evaluación, en 3NF)
CREATE TABLE materiales_apoyo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluacion_id UUID NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(50) NOT NULL, -- 'pdf', 'word', 'imagen', 'texto'
    ruta_archivo VARCHAR(500) NOT NULL,
    descripcion VARCHAR(500),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Exámenes de Estudiantes Calificados
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
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_examen_estudiante_evaluacion UNIQUE (evaluacion_id, codigo_estudiante)
);

-- 10. Historial Inmutable de Entregas (Auditoría 3NF)
CREATE TABLE historial_entregas_estudiantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_estudiante_id UUID NOT NULL REFERENCES examenes_estudiantes(id) ON DELETE CASCADE,
    numero_entrega INT NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    motivo_reenvio TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_historial_examen_entrega UNIQUE (examen_estudiante_id, numero_entrega)
);

-- 11. Detalle por Pregunta (Atómico, 3NF estricto)
CREATE TABLE detalles_preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    examen_estudiante_id UUID NOT NULL REFERENCES examenes_estudiantes(id) ON DELETE CASCADE,
    numero_pregunta INT NOT NULL,
    puntaje_obtenido NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    puntaje_maximo NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    respuesta_detectada TEXT DEFAULT 'nada',
    justificacion TEXT NOT NULL,
    CONSTRAINT uq_examen_pregunta UNIQUE (examen_estudiante_id, numero_pregunta)
);
```

---

## 3. Especificación de Módulos Clave

### 3.1. Módulo de Configuración y Validación de API
1. **Entrada de Clave**: El profesor introduce su API Key.
2. **Selección Dinámica de Modelo**: Se listan los modelos disponibles para el proveedor ingresado (sin predeterminar ni forzar un modelo único).
3. **Botón "Comprobar"**:
   - Envía una petición liviana de comprobación de conectividad y validez de la clave.
   - Si la respuesta es exitosa (código 200 / autenticado): se activa un **icono de check verde** al costado.
   - Si falla: se muestra mensaje de error específico sin bloquear la aplicación.
4. **Almacenamiento de Seguridad**:
   - Por defecto: `sessionStorage` (memoria de sesión del navegador). Si se cierra la pestaña o ventana, la clave se borra de inmediato.
   - Opción opcional: *"Guardar en este dispositivo"* para persistencia local en `localStorage`.

### 3.2. Módulo de Calculadora de Costos
1. Antes de ejecutar la calificación masiva, la aplicación calcula una estimación previa del costo del lote:
   - Número de exámenes/imágenes a calificar.
   - Tamaño y páginas de la solución y materiales de apoyo.
   - Tarifas oficiales por token/imagen del modelo seleccionado.
2. Presenta al profesor un panel resumen:
   - *Costo aproximado total (USD)*.
   - *Total de imágenes / páginas a procesar*.
   - Botón de confirmación para iniciar el procesamiento con presupuesto claro.

### 3.3. Subida de Materiales de Apoyo y Solución
- **Solución Oficial**: Archivo obligatorio (Imagen, PDF o Word) donde el docente incluye la resolución y el valor de cada pregunta.
- **Materiales de Apoyo**: Zona de subida opcional para adjuntar bibliografía, fórmulas, tablas o apuntes complementarios que la IA deba consultar al evaluar.
- **Cuadro de Texto Libre para Indicaciones**: Instrucciones cualitativas que el docente desea que la IA respete rigurosamente (ej: penalizaciones por formato, consideración de respuestas parciales, rigor ortográfico).

### 3.4. Interfaz Web (Material Design - Estilo Google Groups)
- **Paleta y Tipografía**: Fondo blanco (`#ffffff`), sidebar `#f1f3f4`, acentos `#1a73e8`, textos principales `#202124`, textos secundarios `#5f6368`, borde superior `1px solid #e0e0e0`. Tipografía: Inter, Roboto o Google Sans.
- **Top App Bar**: Botón de 3 rayas (hamburguesa) a la izquierda, seguido inmediatamente por el Título del sitio (`text-xl`/`text-lg`, `font-semibold`, `#202124`). Check de API y ajustes a la derecha.
- **Sidebar Explorador**: Fondo `#f1f3f4` sin bordes duros, estructura tipo "Panel de Navegación de Word" (árbol/acordeón). Solo maquetación UI con props/placeholders (`onClick`, `onBack`) sin reescribir el enrutamiento existente.
- **Área Principal**: Tarjetas con sombras sutiles (`shadow-sm`) para el historial de evaluaciones, o **Estado Vacío (Empty State)** centrado con icono gris grande y texto exacto:
  > *"Todavía no hay archivos. Todo está vacío y sin tareas pendientes."*

### 3.5. Módulo de Recepción Autónoma de Alumnos e Historial Inmutable
- **Modalidad Dual por Pestañas**:
  - *"Carga docente (manual)"*: Módulo original para que el profesor suba directamente solución, materiales y fotos de alumnos.
  - *"Recepción de alumnos"*: Módulo autónomo donde los alumnos suben sus propios exámenes y el profesor gestiona la recepción en vivo.
- **Enlace Público y WhatsApp**: Generación de URL `/?entrega=<token>` con botones para copiar enlace y mensaje preformateado para WhatsApp. Los alumnos ingresan desde su teléfono sin registro.
- **Control Estricto de Duplicados en BD**: Restricción de unicidad relacional `(evaluacion_id, lower(trim(codigo_estudiante)))`. Un estudiante no puede volver a enviar su examen a menos que el docente lo autorice.
- **Control de Permisos de Reenvío por el Docente**:
  - *Individual*: Interruptor en la fila del estudiante para permitirle reenviar.
  - *Grupal*: Opción para habilitar reenvíos a toda la sección en caso de incidencias generales.
- **Control de Aforo y Alumnos Presentes en el Aula**:
  - El docente fija de manera previa o dinámica la cantidad de estudiantes que van a dar el examen (`cantidad_estudiantes_esperados`).
  - El sistema bloquea de inmediato nuevos envíos una vez alcanzada la cuota física del salón, impidiendo que estudiantes ausentes o que no asistieron envíen fotos desde el exterior con el enlace compartido.
  - Si un estudiante ya entregó y recibe permiso de reenvío, su reenvío está garantizado y no consume vacantes adicionales del aforo.
  - Indicador de estado en tiempo real en la pantalla del profesor (`X / Y alumnos presentes`).
  - Notificación visual en el portal del alumno informando cordialmente si el cupo fue completado.
- **Historial Inmutable de Entregas (Auditoría 3NF)**: Cada reenvío genera una copia inmutable en `historial_entregas_estudiantes` con número de entrega (`Entrega #1`, `Entrega #2`, etc.) y marca temporal. El docente puede consultar y comparar todas las versiones para verificar qué cambió.
- **Control de Tiempo en el Aula**:
  - Botones *"Cerrar entregas ahora"* y *"Reabrir entregas"* para controlar el aula en tiempo real.
  - Temporizador con cuenta regresiva programada. Reabrir las entregas no elimina las fotos ya entregadas.
- **Previsualización y Rotación Interactiva (90°)**:
  - Estudiante: Vista previa antes de confirmar con rotación 90° interactiva y comprobante de entrega digital.
  - Docente: Visor con rotación (0°, 90°, 180°, 270°), controles de zoom (1x a 3x) y selector de entregas históricas.
- **Revisión por Lotes e Individual**:
  - *"Revisar solo pendientes"*: Califica exámenes que no han sido completados.
  - *"Revisar a todos"*: Recalifica todo el lote.
  - *"Revisar seleccionados"*: Califica los estudiantes seleccionados mediante casillas.
  - Botón individual *"Revisar examen"*: Abre la ventana dividida con imagen y justificaciones por pregunta.
- **Jerarquía Académica Visible**: Muestra en la cabecera `Año` › `Facultad` › `Escuela` › `Ciclo` › `Curso`.
- **Estilo sin Emojis**: Iconos SVG con `lucide-react`.

---

## 4. Flujo Operativo Completo

### Flujo A: Carga Docente Manual
1. El docente sube la solución, materiales e indicaciones en la pestaña *"Carga docente"*.
2. Confirma la rúbrica de preguntas y puntajes.
3. Sube el lote de exámenes escaneados o fotografiados.
4. Prepara la calificación y revisa el costo estimado oficial.
5. Califica y revisa los resultados o descarga el acta en Excel.

### Flujo B: Recepción Autónoma en el Aula
1. El docente configura la evaluación con solución y rúbrica.
2. Abre la pestaña *"Recepción de alumnos"*, fija el aforo de estudiantes presentes en el aula (ej. 30 alumnos) para evitar que personas ausentes suban exámenes, copia el enlace o mensaje de WhatsApp y lo comparte con los alumnos.
3. Los alumnos ingresan desde su smartphone, digitan su código y suben su foto (pudiendo rotarla y verificar nitidez). Si el aforo ya fue completado, el sistema bloquea nuevos registros automáticamente.
4. El docente observa en vivo cómo van llegando las entregas en su teléfono o laptop (`X / Y alumnos presentes`).
5. Al cumplirse el plazo o cerrar las entregas, el docente selecciona *"Revisar solo pendientes"*, *"Revisar a todos"* o *"Revisar seleccionados"*.
6. La IA califica los exámenes y el profesor audita cada examen con la foto del estudiante al lado de las justificaciones.
