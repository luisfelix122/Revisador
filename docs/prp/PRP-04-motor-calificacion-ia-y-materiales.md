# PRP-04: Motor de Calificación por IA y Procesamiento de Materiales

## 1. Resumen y Propósito
Este módulo orquesta la extracción y lectura de los documentos de referencia del profesor (solución oficial, materiales de apoyo complementarios e indicaciones libres) y ejecuta la calificación multimodal de los exámenes de los alumnos procesando lotes de imágenes.

---

## 2. Ingesta de Criterios y Materiales de Referencia

### 2.1. Solución Oficial del Profesor (Multiformato)
* **Formatos Aceptados**:
  - Imagen (`.png`, `.jpg`, `.jpeg`, `.webp`).
  - Documento PDF (`.pdf`) procesado con `pypdf` o renderizado a imagen.
  - Documento Word (`.docx`) procesado con `python-docx`.
* **Detección Automática de Criterios**:
  - La IA analiza la solución para identificar:
    - Número total de preguntas ($P_1, P_2, \dots, P_n$).
    - Puntaje máximo asignado por el docente a cada pregunta (ej. $P_1 = 4\text{ pts}, P_2 = 5\text{ pts}$, etc.).
    - Respuesta o procedimiento modelo esperado.

### 2.2. Materiales de Apoyo Complementarios
* Archivos opcionales que el profesor adjunta como bibliografía, apuntes, formularios o rúbricas de la materia.
* El texto o imágenes de estos materiales se incorporan al contexto del prompt para enriquecer el criterio de corrección.

### 2.3. Cuadro de Texto Libre para Indicaciones
* Espacio sin restricciones donde el profesor redacta sus condiciones pedagógicas:
  - *"Descontar 0.5 puntos si la respuesta no incluye unidades físicas (m/s, kg, etc.)."*
  - *"Considerar puntaje parcial del 50% si el planteamiento es correcto pero hay error aritmético final."*
  - *"Ser estricto con la redacción y ortografía."*

---

## 3. Procesamiento y Calificación de los Exámenes

### 3.1. Lectura Multimodal de Exámenes de Estudiantes
El docente carga las fotos o escaneos de las hojas de examen. Para cada alumno se ejecuta el siguiente proceso:

1. **Extracción de Identidad del Alumno**:
   - Se busca el encabezado con el nombre y código del estudiante.
   - **Regla Estricta**: Si el nombre no es legible, fue omitido o la casilla está en blanco, se debe registrar exactamente como `"nada"`.
2. **Evaluación Pregunta por Pregunta**:
   - Se confronta cada respuesta manuscrita con la solución oficial y los materiales de apoyo.
   - **Regla Estricta**: Si una pregunta no fue respondida o está en blanco, la respuesta detectada se registra como `"nada"` y el puntaje obtenido es `0.00`.
   - Se asigna el puntaje parcial o total según las indicaciones del docente.
   - Se redacta una **justificación clara y constructiva ("el por qué")** explicando el motivo de la calificación asignada.
3. **Consolidación de Nota Final**:
   - La nota final es la suma exacta de los puntajes obtenidos en cada pregunta.
   - Se emite una observación general de síntesis del examen.
4. **Seguridad y Acceso Autorizado a Imágenes**:
   - Validación de rutas en `DocumentosPrivados` asegurando acceso legítimo a exámenes cargados manualmente por el docente (`{usuario_id}/...`) y entregas autónomas de estudiantes (`estudiantes/{evaluacion_id}/...`), con protección estricta contra *path traversal* (`..`).

### 3.2. Modalidades Flexibles de Ejecución del Lote
* **Revisar solo pendientes**: Califica exclusivamente los exámenes que se encuentran en estado `pendiente` (sin nota), optimizando tiempo y cuota de API.
* **Revisar a todos**: Recalifica la totalidad del lote de exámenes, permitiendo actualizar evaluaciones ante cambios en la rúbrica.
* **Revisar seleccionados**: Filtra y califica únicamente a los estudiantes marcados con casilla de verificación en el panel.
* **Revisión individual y auditoría docente**: Permite inspeccionar el examen de un estudiante específico con visor de imagen, rotación interactiva y desglose detallado por pregunta.

---

## 4. Estructura de Salida JSON Estricta de la IA

La respuesta de la IA se fuerza mediante esquema JSON estructurado para alimentar directamente la base de datos en 3NF:

```json
{
  "nombre_estudiante": "Juan Pérez" | "nada",
  "codigo_estudiante": "20210045" | "nada",
  "observaciones_generales": "Buen dominio conceptual, pero descuidó unidades en física.",
  "preguntas": [
    {
      "numero_pregunta": 1,
      "puntaje_obtenido": 4.0,
      "puntaje_maximo": 4.0,
      "respuesta_detectada": "Desarrollo completo usando el teorema de Pitágoras...",
      "justificacion": "Procedimiento idéntico a la solución oficial. Unidades correctas."
    },
    {
      "numero_pregunta": 2,
      "puntaje_obtenido": 0.0,
      "puntaje_maximo": 5.0,
      "respuesta_detectada": "nada",
      "justificacion": "Pregunta no respondida por el alumno."
    }
  ],
  "nota_final": 4.0
}
```

---

## 5. Manejo de Errores y Resiliencia
* **Llamadas Concurrentes con Límite de Tasa**: Uso de semáforos asíncronos (`asyncio.Semaphore`) para no exceder los límites por minuto (RPM) de la API del proveedor.
* **Reintentos Automáticos con Backoff**: En caso de error 429 (Rate Limit) o 500 temporal, reintentos exponenciales automáticos antes de reportar fallo.
