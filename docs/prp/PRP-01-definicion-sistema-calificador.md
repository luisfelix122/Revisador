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
    codigo_estudiante VARCHAR(100) DEFAULT 'nada',
    ruta_imagen_examen VARCHAR(500) NOT NULL,
    nota_final NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    observaciones_generales TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Detalle por Pregunta (Atómico, 3NF estricto)
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

---

## 4. Flujo Operativo Completo

1. **Configuración Previa**: El profesor ingresa la API Key, elige el modelo y presiona **"Comprobar"** hasta ver el **check verde**.
2. **Navegación / Creación en Biblioteca**: Selecciona o crea: Año ➔ Facultad ➔ Escuela ➔ Promoción/Ciclo ➔ Curso ➔ Nueva Evaluación.
3. **Carga de Criterios y Materiales**:
   - Sube la Solución Oficial (con puntaje por pregunta).
   - Sube Materiales de Apoyo (opcional).
   - Ingresa las Indicaciones libres en el cuadro de texto.
4. **Carga de Exámenes de Alumnos**: Arrastra el lote de fotos/escaneos de los alumnos.
5. **Cálculo y Confirmación de Costo**: La calculadora muestra el costo estimado del lote; el docente confirma.
6. **Procesamiento Asíncrono e Inteligente**:
   - La IA analiza los exámenes confrontándolos con la solución, materiales e indicaciones.
   - Fallback `"nada"` para nombres o respuestas ausentes.
7. **Visualización y Exportación**:
   - Visualización inmediata en tabla interactiva con notas, observaciones y detalle por pregunta.
   - Botón para descargar reporte formal en **Excel (`.xlsx`)**.
