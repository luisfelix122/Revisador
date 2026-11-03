# PRP-03: Módulo de Configuración de API, Seguridad y Calculadora de Costos

## 1. Resumen y Propósito
Este módulo permite al profesor configurar de forma agnóstica y segura su proveedor y clave de IA, comprobar la conexión en tiempo real con un indicador visual (check verde) y estimar previamente el costo económico en dólares del lote de exámenes antes de procesarlo.

---

## 2. Configuración y Seguridad de la API Key

### 2.1. Política de Privacidad y Ciclo de Vida Volátil
* **Almacenamiento Predeterminado (`sessionStorage`)**:
  - La clave de API se retiene únicamente en la memoria volátil de la sesión del navegador.
  - Al cerrar la pestaña o el navegador, la clave se destruye de inmediato.
  - Ninguna clave se almacena permanentemente en bases de datos compartidas ni servidores centrales.
* **Persistencia Voluntaria (`localStorage`)**:
  - Casilla de verificación: `[ ] Recordar en este equipo`. Si el docente la marca expresamente, se almacena en el almacenamiento local del dispositivo personal.

### 2.2. Selección Dinámica de Modelos
El sistema no impone un modelo fijo. El selector se adapta dinámicamente según el proveedor:
* **Google Gemini**: Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro.
* **OpenAI**: GPT-4o, GPT-4o-mini.
* **Otros proveedores compatibles**: Claude 3.5 Sonnet / Haiku.

### 2.3. Botón "Comprobar" y Check Visual de Estado
* **Flujo**:
  1. El profesor introduce la clave y selecciona el modelo deseado.
  2. Presiona el botón interactivo **"Comprobar"**.
  3. El frontend emite una petición liviana al backend (`POST /api/configuracion/comprobar-api`).
  4. El backend realiza una llamada ping/eco de prueba (1 token de saludo) a la API oficial.
  5. **Respuesta Visual**:
     - **Éxito**: El botón muestra una animación de éxito y se enciende un **badge/check verde permanente** (`✔ Conexión verificada`).
     - **Fallo**: Se muestra un badge rojo con la razón exacta (ej. *Clave inválida*, *Cuota agotada*, *Error de red*).

---

## 3. Calculadora de Costos Estimados

### 3.1. Objetivo
Otorgar previsibilidad económica absoluta al docente antes de enviar a calificar un lote grande de alumnos.

### 3.2. Parámetros de Entrada del Cálculo
1. **Cantidad de exámenes de alumnos** (número de imágenes subidas).
2. **Volumen de la solución oficial** (número de páginas o imágenes).
3. **Volumen de materiales de apoyo complementarios** (PDFs/Word/imágenes adjuntas).
4. **Tarifario vigente del modelo seleccionado** (costo por millón de tokens de entrada/visión y costo por millón de tokens de salida).

### 3.3. Fórmula de Estimación
$$\text{Tokens Entrada Estimados} = (\text{Tokens Solución} + \text{Tokens Materiales} + \text{Tokens Indicaciones} + \text{Tokens Imagen Examen}) \times N_{\text{alumnos}}$$
$$\text{Tokens Salida Estimados} = (\text{Tokens Promedio Retroalimentación por Alumno}) \times N_{\text{alumnos}}$$
$$\text{Costo Total Estimado (USD)} = (\text{Tokens Entrada} \times \text{Tarifa Entrada}) + (\text{Tokens Salida} \times \text{Tarifa Salida})$$

### 3.4. Interfaz Visual de la Calculadora
Aparece como un panel de confirmación justo antes de presionar el botón "Comenzar Calificación":
* 📄 **Exámenes a procesar**: *35 alumnos*
* 📚 **Materiales y Solución**: *3 páginas en total*
* 🤖 **Modelo seleccionado**: *Gemini 2.0 Flash*
* 💰 **Costo aproximado**: *~$0.02 USD (Prácticamente gratuito en capa estándar)*
* Botón: `[ Confirmar y Calificar Lote ]`
