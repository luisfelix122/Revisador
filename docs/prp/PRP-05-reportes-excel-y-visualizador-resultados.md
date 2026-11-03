# PRP-05: Generación de Reportes Excel (.xlsx) y Visualizador de Resultados

## 1. Resumen y Propósito
Este módulo define cómo se presentan los resultados de la evaluación en la aplicación web para el profesor y cómo se estructura el archivo descargable de Excel (`.xlsx`), garantizando un diseño profesional, legible y formal para su archivo o entrega administrativa.

---

## 2. Visualizador Web de Resultados

### 2.1. Panel Resumen de la Evaluación
* **Encabezado**:
  - Curso, Escuela, Facultad, Año y Denominación de la Evaluación.
  - Indicadores rápidos (KPIs): Total de alumnos evaluados, promedio general de notas, nota máxima, nota mínima y porcentaje de aprobados.
* **Buscador y Filtros**:
  - Búsqueda en tiempo real por nombre o código del alumno.
  - Filtro por estado (Aprobados, Desaprobados, Sin responder `"nada"`).

### 2.2. Tabla Interactiva de Resultados
* **Columnas Principales**:
  - `N°`: Orden correlativo.
  - `Estudiante`: Nombre extraído (o badge `"nada"` en gris neutro si no fue identificado).
  - `Código`: Código del alumno (o `"nada"`).
  - `Nota Final`: Calificación numérica con formato visual (verde para aprobado, rojo/ámbar para desaprobado).
  - `Observaciones Generales`: Resumen explicativo emitido por la IA.
  - `Acciones`: Botón para desplegar el modal o acordeón con el desglose por pregunta ($P_1, P_2, \dots, P_n$) con sus respectivas justificaciones individuales.

---

## 3. Generación y Estructura del Archivo Excel (`.xlsx`)

### 3.1. Librería y Tecnología
* Generación nativa con `openpyxl` en el backend FastAPI, garantizando estilos de celda, anchos automáticos, bordes y formatos numéricos consistentes.

### 3.2. Estructura de la Hoja de Cálculo
El libro generado contendrá una hoja principal denominada `Acta_de_Notas`:

1. **Bloque Institucional (Filas 1 a 5)**:
   - Fila 1: Título institucional en negrita (*SISTEMA DE CALIFICACIÓN ACADÉMICA*).
   - Fila 2: `Facultad:` [Nombre] | `Escuela:` [Nombre].
   - Fila 3: `Año:` [Año] | `Ciclo/Promoción:` [Ciclo].
   - Fila 4: `Curso:` [Nombre del Curso] | `Evaluación:` [Título de la Evaluación].
   - Fila 5: `Fecha de Emisión:` [DD/MM/AAAA].

2. **Fila de Encabezados de Datos (Fila 7)**:
   - Con fondo azul marino institucional, texto blanco y negrita:
   - `[ N° | Código | Nombre del Estudiante | P1 (X pts) | P2 (X pts) | ... | Pn (X pts) | NOTA FINAL | JUSTIFICACIÓN Y OBSERVACIONES ]`

3. **Cuerpo de Datos (Filas 8 en adelante)**:
   - Nombres no detectados: Se muestra el texto explícito `"nada"`.
   - Respuestas omitidas: Se coloca el valor `0.00` con texto `"nada"`.
   - Formato numérico para notas: Decimal con 2 dígitos (`0.00`).
   - Justificación: Texto con ajuste de línea automático (*wrap text*).

4. **Bloque Estadístico al Pie**:
   - `Promedio del Grupo`: Fórmula Excel `=PROMEDIO(J8:Jn)`.
   - `Nota Más Alta`: Fórmula `=MAX(J8:Jn)`.
   - `Nota Más Baja`: Fórmula `=MIN(J8:Jn)`.
   - `Aprobados`: Fórmula `=CONTAR.SI(J8:Jn, ">=11")`.

---

## 4. Descarga Inmediata
* Botón destacado en la interfaz: `[ 📥 Descargar Reporte en Excel (.xlsx) ]`.
* El archivo se genera en milisegundos mediante un flujo binario directo (`StreamingResponse`) con el nombre normalizado:
  `Acta_[Curso]_[Evaluacion]_[Fecha].xlsx`
