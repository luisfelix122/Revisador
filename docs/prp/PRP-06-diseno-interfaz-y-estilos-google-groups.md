# PRP-06: Diseño de Interfaz y Sistema de Estilos (Material Design - Google Groups)

## 1. Filosofía de Diseño y Paleta Obligatoria
Construcción de la interfaz web completa utilizando los principios de **Material Design**, replicando estrictamente la estética, paleta de colores y componentes de **Google Groups**.

### 1.1. Paleta de Colores Obligatoria
* **Fondo Principal**: Blanco puro (`#ffffff`).
* **Fondo de la Barra Lateral y Menús**: Gris muy tenue (`#f1f3f4`).
* **Acentos y Botones Principales**: Azul Google (`#1a73e8`).
* **Textos Principales**: Gris oscuro casi negro (`#202124`).
* **Textos Secundarios y Bordes**: Gris medio (`#5f6368`).
* **Borde Inferior de la Barra Superior**: `1px solid #e0e0e0`.

### 1.2. Tipografía Obligatoria
* **Familia Tipográfica**: `Inter`, `Roboto` o `Google Sans`, sans-serif.
* **Escala y Pesos**:
  - Encabezado de barra superior: `text-xl` o `text-lg`, `font-semibold`, color `#202124`.
  - Títulos de tarjetas y secciones: `text-base` o `text-lg`, `font-medium`, color `#202124`.
  - Metadatos, fechas y secundarios: `text-sm`, `font-normal`, color `#5f6368`.

---

## 2. Estructura del Layout (Pantalla Dividida Clásica)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Menu] Revisador                       [ Buscar... ]                  [API Conectada]  │ (Top Bar)
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│                      │                                                                 │
│ Panel de Navegación  │  CONTENIDO PRINCIPAL (Fondo #ffffff, padding generoso)         │
│ (Estilo Word / Árbol)│                                                                 │
│                      │  [ Estado con datos: Tarjetas con sombra sutil shadow-sm ]      │
│ Fondo #f1f3f4        │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│ Sin bordes duros     │  │ Examen P-1   │  │ Práctica 2   │  │ Final Física │           │
│                      │  │ 35 alumnos   │  │ 28 alumnos   │  │ 40 alumnos   │           │
│ 2026                 │  └──────────────┘  └──────────────┘  └──────────────┘           │
│   > Fac. Ingeniería  │                                                                 │
│     > Esc. Sistemas  │  ─────────────────────────────────────────────────────────────  │
│       > Ciclo 2026-I │  [ Estado Vacío (Empty State) ]:                                │
│         Curso        │                     [ Icono Folder ] (Gris grande)              │
│                      │   "Todavía no hay archivos. Todo está vacío y sin tareas        │
│ [props: onClick...]  │    pendientes."                                                 │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
 (Sidebar / Explorador)                    (Área Central / Derecha)
```

### 2.1. Barra de Navegación Superior (Top App Bar)
* **Apariencia**: Limpia, con fondo blanco puro (`#ffffff`) y borde inferior muy sutil (`1px solid #e0e0e0`). Altura estándar (56px a 64px).
* **Extremo Superior Izquierdo**:
  1. **Botón Icono Hamburguesa**: Botón con las 3 rayas horizontales (`Menu` de `lucide-react`) para controlar la visibilidad y colapso del panel lateral.
  2. **Título del Sitio Web**: Ubicado inmediatamente a la derecha del menú hamburguesa, debe mostrarse el texto **"Revisador"** con tamaño de encabezado (`text-xl` o `text-lg`), peso semibold (`font-semibold`) y color gris oscuro (`#202124`).
* **Extremo Superior Derecho**:
  - Badge visual de estado de API (icono SVG `Check` verde `#137333` o gris `#5f6368` si no está configurada).
  - Botón icono de ajustes (`Settings` de `lucide-react`) para abrir el modal de configuración de API y calculadora de costos.

### 2.2. Panel Lateral Izquierdo (Sidebar / Explorador)
* **Diseño Visual**:
  - Fondo gris tenue (`#f1f3f4`), sin bordes duros de división.
  - Ítems de navegación: al pasar el cursor (*hover*), adquieren un fondo gris un poco más oscuro o un azul muy claro con bordes redondeados (`rounded-lg` o `rounded-full`).
* **Comportamiento y Estructura**:
  - Estructura de explorador de contenido similar al **"Panel de Navegación" de Microsoft Word** (estilo acordeón o árbol expandible/colapsable con niveles: Año ➔ Facultad ➔ Escuela ➔ Ciclo/Promoción ➔ Curso).
* **Regla Estricta de Integración**:
  - La lógica de enrutamiento, el despliegue de los títulos y la funcionalidad de "regresar" en el navegador ya están implementadas en el proyecto.
  - **Solo se debe maquetar la UI (HTML/CSS/Tailwind)** dejando los placeholders, props y eventos (ej. `onClick`, `onBack`, `isOpen`, `activeId`) listos para conectar la lógica existente.
  - **No reescribir ni sobreescribir el sistema de navegación**.

### 2.3. Área Central/Derecha (Contenido Principal)
* **Lienzo**: Ocupa el resto de la pantalla con fondo blanco puro (`#ffffff`) y márgenes (*padding*) generosos (`p-6` a `p-8`).
* **Estado con Datos (Historial de Archivos Recientes)**:
  - Muestra una lista o cuadrícula de tarjetas (*cards*) con elevación muy baja (sombras sutiles `shadow-sm`, borde sutil `border border-[#e0e0e0]`, `rounded-xl`) que representan los archivos y evaluaciones recién hechos.
  - Cada tarjeta expone: Título de la evaluación, fecha, número de exámenes calificados, promedio de notas y botón de acceso rápido para ver resultados o descargar Excel.
* **Estado Vacío (Empty State Obligatorio)**:
  - Si no hay actividad o la carpeta seleccionada no contiene archivos, la interfaz debe mostrar un contenedor perfectamente centrado vertical y horizontalmente (`flex flex-col items-center justify-center min-h-[400px]`).
  - **Icono**: Icono gris grande (ej. carpeta vacía / `FolderOpen` o `FileQuestion` en color `#5f6368` o `#9aa0a6`, tamaño 64px a 80px).
  - **Mensaje Exacto**: Texto en color gris medio (`#5f6368`), tamaño `text-base` o `text-lg`:
    > **"Todavía no hay archivos. Todo está vacío y sin tareas pendientes."**

---

## 3. Componentes Adicionales de Google Groups Integrados

### 3.1. Modal de Configuración de API
* Ventana modal blanca con sombra suave (`shadow-xl`, `rounded-2xl`).
* Input de API Key y selector de modelo con contorno que se ilumina en azul Google (`#1a73e8`).
* Botón **"Comprobar"**: azul Google (`#1a73e8`), texto blanco; al validar exitosamente muestra el check visual verde (`#1e8e3e`).

### 3.2. Panel de Calculadora de Costos
* Tarjeta informativa integrada antes de procesar el lote, con fondo `#f8f9fa` y tipografía clara.

### 3.3. Tabla de Resultados de Exámenes
* Formato de alta densidad inspirado en Google Workspace / Groups:
  - Filas de 48px de alto, borde inferior `1px solid #e0e0e0`.
  - Hover tenue (`#f8f9fa`).
  - Fallback `"nada"` destacado con un chip neutro (`bg-[#f1f3f4] text-[#5f6368]`).
  - Botón para descargar Excel (`.xlsx`) alineado al estilo de Google Sheets.

### 3.4. Modalidad Dual por Pestañas en la Evaluación
* Cabecera de la evaluación con selector de pestañas estilo Google Material:
  - **Carga docente (manual)**: Carga de solución, materiales complementarios, rúbrica de puntajes y exámenes escaneados.
  - **Recepción de alumnos**: Monitoreo en vivo de entregas, enlace público compartible y botón directo para WhatsApp.
* Panel docente de control de aula:
  - Selector de tiempo y botones "Cerrar entregas ahora" / "Reabrir entregas".
  - Control de aforo en aula (`X / Y alumnos presentes`) con advertencia visual de cupo completado.
  - Conmutadores para autorizar reenvíos (individual y masivo para la sección).

### 3.5. Portal Público de Entrega del Estudiante (Móvil)
* Acceso limpio mediante enlace con token (`/?entrega=<token>`) sin exigir creación de cuenta ni contraseñas.
* Muestra de la jerarquía académica institucional (`Año` · `Facultad` · `Escuela` · `Curso`).
* Formulario móvil con selector de cámara (`capture="environment"`) o subida de archivo (PDF/imagen).
* Previsualización interactiva con botón de rotación a 90° (0°, 90°, 180°, 270°).
* Comprobante digital de entrega con número correlativo (`Entrega #1`) y fecha/hora exacta.
* Advertencia cordial si el aforo físico programado para el aula fue completado.
