# Guía de Agentes y Estándares del Proyecto: Revisador (AGENTS.md)

Este documento define el stack tecnológico, la arquitectura del software, las convenciones de desarrollo y la metodología obligatoria para los agentes y desarrolladores que colaboren en el proyecto **Revisador** (Calificador de Exámenes para Profesores).

---

## 1. Stack Tecnológico

* **Backend**: Python (FastAPI) — Ideal para procesamiento concurrente por lotes de imágenes, documentos (PDF, Word con `Pillow`, `pypdf`, `python-docx`) y comunicación asíncrona con modelos de IA.
* **Frontend**: React (con Vite o Next.js) + Tailwind CSS — Interfaz responsiva, moderna y limpia tipo biblioteca/árbol académico.
* **Base de Datos**: **Supabase (PostgreSQL)**.
  - **Requisito Estricto**: Modelo relacional diseñado como mínimo en **Tercera Forma Normal (3NF)**.
* **Almacenamiento de Archivos (Storage)**: Supabase Storage (o almacenamiento local en desarrollo) para exámenes de alumnos, soluciones del profesor y materiales de apoyo complementarios.
* **Generación de Reportes**: `openpyxl` / `pandas` para exportación nativa a hojas de cálculo Excel (`.xlsx`).
* **Integración de IA (Agnóstica y Dinámica)**:
  - Diseño desacoplado para soportar múltiples proveedores y modelos.
  - No se predefine un modelo rígido; el usuario selecciona el modelo según la clave ingresada.
* **Pruebas (Testing)**: Pytest para backend y Vitest para frontend.

---

## 2. Jerarquía Académica y Estructura de Datos (3NF)

La aplicación sigue una estructura jerárquica estricta para organizar los cursos y evaluaciones:

```
Año Académico
  └── Facultad
        └── Escuela Profesional
              └── Promoción / Ciclo
                    └── Curso
                          └── Evaluación (Solución, Materiales de Apoyo, Indicaciones, Puntuaciones, Recepción Autónoma)
                                └── Examen de Estudiante (Fotos, Calificación, Justificación, Estado, Reenvío)
                                      ├── Detalle por Pregunta (Puntaje Obtenido, Máximo, Justificación IA)
                                      └── Historial de Entregas Inmutable (Versiones #1, #2, Auditoría Docente)
```

### Reglas de Normalización (Mínimo 3NF):
1. **1NF**: Tablas con clave primaria única, valores atómicos, sin listas ni grupos repetitivos.
2. **2NF**: Cumple 1NF y todos los atributos no clave dependen funcionalmente de la totalidad de la clave primaria.
3. **3NF**: Cumple 2NF y ningún atributo no clave depende transitivamente de la clave primaria (todas las dependencias funcionales son directas respecto a la clave).

---

## 3. Módulos Especiales del Sistema

### 3.1. Módulo de Configuración y Seguridad de API
- **Entrada de API Key**: Campo para que el profesor ingrese su clave de proveedor.
- **Selección de Modelo**: Lista desplegable dinámica que se habilita según el proveedor de la clave.
- **Botón "Comprobar"**: Valida la conexión en tiempo real contra la API y muestra un **check visual de confirmación** si la configuración es correcta.
- **Seguridad y Persistencia Volátil**: La clave se almacena en memoria de sesión del navegador (`sessionStorage`), borrándose automáticamente al cerrar la ventana, con opción voluntaria de conservarla localmente en el dispositivo.

### 3.2. Calculadora de Costos Estimados
- Herramienta visual previa al envío del lote:
  - Calcula el costo aproximado del procesamiento según la cantidad de imágenes de exámenes subidas, cantidad de páginas de materiales y el modelo de IA seleccionado.
  - Otorga predictibilidad y control del presupuesto al profesor antes de ejecutar la calificación.

### 3.3. Materiales de Apoyo Complementarios
- Posibilidad de subir archivos adicionales (PDF, Word, imágenes, apuntes) para que la IA los considere como bibliografía y contexto complementario al corregir.

### 3.4. Módulo de Recepción Autónoma de Alumnos e Historial Inmutable
- **Modalidad Dual por Pestañas**: Pestaña "Carga docente (manual)" y pestaña "Recepción de alumnos" en la cabecera de la evaluación, permitiendo alternar sin perder datos.
- **Acceso Público para Estudiantes**: Enlace compartible y texto formateado para WhatsApp (`/?entrega=<token>`) donde los alumnos suben sus fotos o PDF desde su teléfono móvil sin necesidad de crear cuenta ni registrarse.
- **Control Estricto de Duplicados en Base de Datos**: Restricción de unicidad relacional `(evaluacion_id, lower(trim(codigo_estudiante)))`. Un alumno no puede reenviar por su cuenta una vez entregado.
- **Control de Permisos de Reenvío por el Docente**: El profesor tiene el control absoluto para habilitar reenvíos:
  - *Individual*: Switch/botón por estudiante en la tabla.
  - *Grupal*: Opción para habilitar reenvíos a toda la clase simultáneamente.
- **Control de Aforo y Alumnos Presentes en Aula**:
  - El docente define la cantidad esperada de estudiantes que rinden la prueba en el salón (`cantidad_estudiantes_esperados`) para prevenir que alumnos ausentes o fuera del aula suban exámenes con el enlace compartido.
  - Bloqueo automático en base de datos al alcanzar el aforo configurado (`COUNT(*) >= cantidad_estudiantes_esperados`), emitiendo mensaje cordial de cupo completado.
  - Los reenvíos autorizados de estudiantes ya registrados no consumen vacantes extras.
  - Indicador visual en tiempo real en panel docente (`Entregas recibidas: X / Y alumnos en aula`) y advertencia para alumnos si el aforo fue completado.
- **Historial Inmutable de Entregas (3NF)**: Tabla `historial_entregas_estudiantes`. Ningún reenvío borra ni sobrescribe entregas previas. Todas las versiones (`Entrega #1`, `Entrega #2`, etc.) quedan grabadas con timestamp para que el profesor audite qué cambió el estudiante.
- **Control de Tiempo en el Aula**:
  - Botón *"Cerrar entregas ahora"* y *"Reabrir entregas"* para atender incidencias en el salón sin borrar las entregas ya registradas.
  - Temporizador programable con minutos de tolerancia y cuenta regresiva visible para alumnos y docente.
- **Previsualización y Rotación Interactiva (90°)**:
  - Estudiantes: Vista previa antes de confirmar con botón de giro 90° (0°, 90°, 180°, 270°) y comprobante digital con número de entrega y hora.
  - Docente: Visor con rotación (0°, 90°, 180°, 270°), controles de zoom (1x a 3x) y selector de versiones para comparar entregas históricas del alumno.
- **Modalidades de Calificación Flexibles**:
  - *"Revisar solo pendientes"*: Califica únicamente exámenes que no han sido completados.
  - *"Revisar a todos"*: Reinicia y recalifica la totalidad del lote.
  - *"Revisar seleccionados"*: Procesa solo los alumnos marcados con casilla de verificación.
  - Botón individual *"Revisar examen"*: Abre la ventana dividida con foto del examen y justificaciones detalladas por pregunta.
- **Jerarquía Académica Visible**: Se mantiene visible en todo momento la ruta de navegación jerárquica (`Año` › `Facultad` › `Escuela` › `Ciclo` › `Curso`).
- **Diseño sin Emojis**: Iconografía exclusivamente SVG mediante `lucide-react` respetando Material Design estilo Google Groups.

---

## 4. Arquitectura: Arquitectura Limpia (Clean Architecture)

El sistema se estructura en capas concéntricas con regla de dependencia estricta hacia adentro:

```
┌─────────────────────────────────────────────────────────┐
│            Presentación / API (FastAPI, UI React)       │
│  ┌───────────────────────────────────────────────────┐  │
│  │     Infraestructura (Supabase, IA APIs, Excel)    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │   Aplicación (Casos de Uso, DTOs, Puertos)  │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │     Dominio (Entidades, Reglas,       │  │  │  │
│  │  │  │             Excepciones)              │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Capas:

1. **Capa de Dominio (`dominio/`)**:
   - Entidades puras: `AnioAcademico`, `Facultad`, `Escuela`, `PromocionCiclo`, `Curso`, `Evaluacion`, `SolucionProfesor`, `MaterialApoyo`, `ExamenEstudiante`, `DetallePregunta`.
   - Reglas de negocio:
     - Si el nombre del alumno no es legible o no fue colocado, registrar como `"nada"`.
     - Si una respuesta no fue contestada, registrar como `"nada"` con puntaje 0.
     - La suma de los puntajes de las preguntas debe coincidir con la nota final calculada.
   - Interfaces (Puertos): `IProveedorVisionIA`, `IRepositorioEvaluaciones`, `IGeneradorExcel`, `IAlmacenamientoArchivos`, `ICalculadoraCostos`.

2. **Capa de Aplicación (`aplicacion/`)**:
   - Casos de uso:
     - `CalificarLoteExamenes`: Orquesta la lectura de la solución, materiales de apoyo, indicaciones libres, llamadas a la IA y consolidación de notas.
     - `ValidarConexionApi`: Realiza una prueba de ping/eco con la API del proveedor para encender el check de confirmación.
     - `CalcularCostoEstimado`: Calcula la estimación económica previa del lote según el modelo seleccionado.
     - `GenerarReporteExcelNotas`: Construye el archivo `.xlsx` estructurado.
     - `GestionarJerarquiaAcademica`: Creación y consulta de años, facultades, escuelas, promociones y cursos.
   - DTOs (Data Transfer Objects) para desacoplar entradas y salidas.

3. **Capa de Infraestructura (`infraestructura/`)**:
   - `adaptadores/ia/`: Implementación agnóstica de proveedores de IA con validación de credenciales.
   - `adaptadores/supabase/`: Repositorios con cliente Supabase / PostgreSQL respetando 3NF.
   - `adaptadores/excel/`: Generador con `openpyxl`.
   - `adaptadores/archivos/`: Extractor de texto e imágenes desde PDF (`pypdf`), Word (`python-docx`) e imágenes (`Pillow`).

4. **Capa de Presentación (`presentacion/`)**:
   - Endpoints REST FastAPI en español (`/configuracion/comprobar-api`, `/evaluaciones/calificar`, `/evaluaciones/calcular-costo`, `/reportes/excel`).
   - Interfaz gráfica en React con **Material Design estilo Google Groups**:
     - Paleta obligatoria: Fondo `#ffffff`, sidebar/menús `#f1f3f4`, acentos `#1a73e8`, textos principales `#202124`, textos secundarios `#5f6368`, borde superior `1px solid #e0e0e0`.
     - Barra superior: Hamburguesa a la izquierda + Título inmediato: **Revisador** (`text-xl`/`text-lg`, `font-semibold`, `#202124`) + check de API a la derecha.
     - Sidebar explorador: Estilo panel de navegación de Word (árbol/acordeón) con props/placeholders (`onClick`, `onBack`) listos para conectar la lógica sin reescribir enrutamiento.
     - Área principal: Cuadrícula/lista de tarjetas de archivos recientes (sombra sutil) o Estado Vacío centrado con texto exacto: *"Todavía no hay archivos. Todo está vacío y sin tareas pendientes."*
     - Panel de configuración con check de estado, calculadora de costos y visor de notas con descarga Excel.

---

## 5. Convención de Idioma: Código 100% en Español

* **Idioma Obligatorio**: Todo el código fuente, base de datos y documentación en **español**.
  - **Tablas y Columnas SQL**: `anios_academicos`, `facultades`, `escuelas`, `promociones_ciclos`, `cursos`, `evaluaciones`, `soluciones_profesor`, `materiales_apoyo`, `examenes_estudiantes`, `detalles_preguntas`.
  - **Clases y Métodos**: `CalificadorLoteExamenes`, `validar_credenciales_api()`, `calcular_costo_lote()`, `exportar_reporte_excel()`.
  - **Variables y Parámetros**: `ruta_solucion`, `lista_examenes`, `archivos_apoyo`, `indicaciones_profesor`, `nota_final`, `observaciones`.
  - **Tests**: `test_debe_mostrar_check_cuando_api_es_valida()`, `test_debe_asignar_nada_cuando_el_nombre_no_es_visible()`.

---

## 6. Metodología: TDD (Test-Driven Development)

1. **Rojo (Red)**: Escribir una prueba unitaria antes de la implementación, asegurando que falle inicialmente.
2. **Verde (Green)**: Implementación mínima para que la prueba pase.
3. **Refactorización (Refactor)**: Optimización del código preservando el 100% de tests aprobados.

- Cobertura estricta para validación de API, cálculo de costos, reglas de negocio y generación de reportes.
