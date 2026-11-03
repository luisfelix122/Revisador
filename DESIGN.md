---
name: Revisador
description: Biblioteca académica sobria con dirección Material Design estilo Google Groups.
colors:
  principal: "#1a73e8"
  principal-hover: "#1765cc"
  seleccion-texto: "#185abc"
  seleccion-lateral: "#dce8fa"
  seleccion-suave: "#e8f0fe"
  seleccion-documento: "#d2e3fc"
  fondo: "#ffffff"
  lateral: "#f1f3f4"
  superficie-suave: "#f8f9fa"
  superficie-hover: "#f8faff"
  texto: "#202124"
  secundario: "#5f6368"
  icono-suave: "#80868b"
  inactivo: "#9aa0a6"
  borde-barra: "#e0e0e0"
  borde-control: "#dadce0"
  borde-suave: "#e8eaed"
  borde-hover: "#b8c9e5"
  api-verificada: "#1e8e3e"
  exito-texto: "#137333"
  exito-fondo: "#e6f4ea"
  error-texto: "#b3261e"
  error-fondo: "#fce8e6"
typography:
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.65px"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.45px"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 500
rounded:
  etiqueta: "4px"
  campo: "5px"
  accion: "6px"
  buscador: "8px"
  conexion: "10px"
  tarjeta: "12px"
  crear: "14px"
  ventana: "16px"
  icono: "50%"
spacing:
  compacto: "8px"
  pequeno: "12px"
  base: "16px"
  contenido: "24px"
  amplio: "28px"
components:
  boton-primario:
    backgroundColor: "{colors.principal}"
    textColor: "{colors.fondo}"
    rounded: "{rounded.accion}"
    padding: "11px 18px"
  boton-primario-hover:
    backgroundColor: "{colors.principal-hover}"
  boton-contorno:
    backgroundColor: "{colors.fondo}"
    textColor: "{colors.principal}"
    rounded: "{rounded.campo}"
    padding: "10px 14px"
  boton-texto:
    textColor: "{colors.principal}"
    rounded: "{rounded.campo}"
    padding: "10px 12px"
  campo:
    backgroundColor: "{colors.fondo}"
    rounded: "{rounded.campo}"
    height: "43px"
    padding: "0 12px"
  navegacion-activa:
    backgroundColor: "{colors.seleccion-lateral}"
    textColor: "{colors.seleccion-texto}"
    height: "44px"
    padding: "0 18px"
  tarjeta:
    backgroundColor: "{colors.fondo}"
    textColor: "{colors.texto}"
    rounded: "{rounded.tarjeta}"
  etiqueta:
    backgroundColor: "{colors.lateral}"
    rounded: "{rounded.etiqueta}"
    padding: "4px 8px"
---

# Design System: Revisador

## Overview

**Creative North Star: "Biblioteca académica estilo Google Groups"**

Dirección visual fijada por el usuario y PRP-06, no una identidad nueva. Una biblioteca sin ruido: superficie blanca, explorador gris, azul funcional e iconos de línea. La densidad favorece encontrar y organizar evaluaciones; no convierte la pantalla en una landing page ni en un tablero de métricas ficticias.

La jerarquía se construye con alineación, espacio, tipografía contenida y estados explícitos. El criterio final pertenece al profesor. Este documento describe código existente, no promete que los flujos pendientes estén integrados.

**Key Characteristics:**
- Biblioteca sobria y operativa, con explorador académico persistente en escritorio.
- Azul para acciones y selección; neutros para estructura y contenido.
- Estados vacíos honestos, sin evaluaciones ni resultados inventados.
- Inter autoalojada, controles etiquetados y foco visible.

Fuente de verdad: `presentacion/web/estilos.css`, `Aplicacion.tsx`, `componentes/`, `servicios/usarPanelMovil.ts` y `principal.tsx`. Contexto: `PRODUCT.md`, `.impeccable/surfaces/biblioteca.md` y contrato de `index.html`.

## Colors

Paleta funcional de un acento principal sobre blancos y grises; los valores normativos están en el frontmatter.

### Primary
- **Azul de acción** (`principal`): botones principales, enlaces de acción, caret, checkbox y foco.
- **Azul presionado visual** (`principal-hover`): hover del botón principal; no es un estado persistente.
- **Azules de selección** (`seleccion-texto`, `seleccion-lateral`, `seleccion-suave`): navegación activa, rama seleccionada, selector de vista y hover de acciones secundarias. `seleccion-documento` corresponde a selección de texto.

### Neutral
- **Blanco de biblioteca** (`fondo`): contenido, barra superior y ventanas.
- **Gris de explorador** (`lateral`): panel lateral, buscador y etiquetas de evaluación.
- **Gris de apoyo** (`superficie-suave`): panel de conexión, portada de tarjeta y resultado de costos.
- **Tinta principal** (`texto`) y **gris de lectura secundaria** (`secundario`): títulos frente a ayudas, metadatos e iconos.
- **Grises de icono** (`icono-suave`, `inactivo`): carpeta vacía, estado no verificado y detalles terciarios.
- Bordes separados para barra, control y superficie; no sustituirlos por líneas de alto contraste.

### Estados semánticos
- API verificada combina verde e icono de check, además de nombre accesible.
- Éxito combina `exito-texto` con `exito-fondo`; error combina `error-texto` con `error-fondo`. Los mensajes incluyen texto y roles de anuncio, no dependen solo del color.

**The Azul Funcional Rule.** Reservar el acento para acción, selección y foco; no teñir grandes áreas decorativas.

## Typography

Inter con respaldo sans-serif. `principal.tsx` importa las variantes latinas de pesos 400, 500 y 600 desde `@fontsource/inter`: fuente autoalojada en el paquete, sin petición a Google Fonts. Base raíz de 14px; no hay tipografía display ornamental ni familia monoespaciada propia.

- **Headline:** título de página del frontmatter; en móvil se reduce a 23px.
- **Title:** marca Revisador; en móvil pasa a 19px. Títulos de ventana de 19px/500 y tracking -0.3px.
- **Body:** cuerpo base; descripción de cabecera de 13px con interlineado 1.6. Vacío de 14px/1.8, máximo 440px; en móvil 13px.
- **Label:** botones principales y campos; ayudas y metadatos alternan 10–12px según jerarquía. No usar mayúsculas sostenidas como lenguaje dominante.
- Tarjeta: título 15px/500; vacío: 19px/500, en móvil 18px. Estimación: 24px/500 con cifras tabulares.

## Layout

Marco de aplicación en grid: barra de 64px y explorador de 264px; contenido `minmax(0, 1fr)`. Barra con menú a la izquierda, marca inmediata, buscador y estado/configuración a la derecha. Línea divisoria inferior discreta. Colapsar el explorador lleva su columna a cero sin desmontar el contenido principal.

Contenido con padding superior de 28px y laterales de 40px. Hasta 1100px, los laterales pasan a 28px y se oculta el texto largo del estado API, conservando indicador y etiqueta accesible. Desde 1600px se amplían a 56px. Buscador de 44px de alto y máximo 640px.

Hasta 760px: una sola columna; barra conserva 64px, contenido usa 22px 20px 0. El buscador se revela con botón y recibe foco, en un panel absoluto a 72px del borde superior. Escape lo cierra. El CTA de cabecera se oculta; el estado vacío y el explorador mantienen accesos a la preparación.

Explorador móvil de 264px fijo debajo de la barra, scroll propio, velo y botón de cierre. Comienza cerrado; al entrar al tamaño móvil mediante resize se cierra. No es una segunda página ni un router.

Cuadrícula de evaluaciones con `repeat(auto-fill, minmax(240px, 1fr))`, separación de 20px; lista de una columna con portada lateral de 100px. Nombres largos admiten salto. Estado vacío flexible con mínimo 400px, o 390px en móvil. El cuerpo admite desde 320px; la revisión móvil de referencia es 390px.

## Elevation & Depth

Sistema plano por defecto: tonos y bordes separan las áreas. Sombras pequeñas para creación, tarjetas y buscador enfocado; la mayor elevación queda reservada a ventanas y drawer móvil. No añadir vidrio, degradados o sombras de hero.

- Creación: `0 1px 3px #3c404326`; hover `0 2px 5px #3c404333`.
- Tarjeta: `0 1px 2px #20212414`.
- Buscador enfocado: `0 1px 5px #20212433`; buscador móvil abierto: `0 2px 8px #20212433`.
- Ventana: `0 12px 40px #20212433`; velo `#20212466`.
- Drawer móvil: `4px 0 14px #2021241a`; fondo `#20212455`.

Transiciones de color de fondo y sombra de 150ms. Ventana entra en 180ms ease-out desde 8px de desplazamiento vertical y recorte inferior; `prefers-reduced-motion: reduce` elimina animaciones y transiciones.

## Shapes

Curvas moderadas según función: campos y acciones pequeñas; tarjetas, paneles y ventanas progresivamente más suaves. Iconos accionables circulares de 40px (variante pequeña de 30px); navegación lateral con extremo derecho redondeado de 24px y extremo izquierdo recto. No convertir todo en píldoras.

Bordes finos de 1px. Selector de vista recorta sus hijos dentro del contorno, con divisor central. Su foco se dibuja hacia dentro para que el recorte no lo oculte.

## Components

### Botones
Primario azul, texto blanco, peso 500 y tamaño 12px; alto mínimo 40px. Hover oscurece y añade sombra discreta. Contorno blanco con texto azul, borde de control y hover azul suave; texto sin fondo hasta hover. Botón de preparación blanco con icono azul, radio de creación y sombra ligera. Botones deshabilitados tienen cursor no permitido y opacidad 0.55, salvo tarjetas de evaluación que conservan opacidad 1.

Foco general: outline azul de 2px con offset 3px en botones, enlaces, inputs y selects. Selector de vista usa offset -3px. Buscador usa `focus-within`, fondo blanco y sombra en lugar del outline interior. Conservar enlace «Saltar al contenido», visible al recibir foco.

### Navegación y explorador
Fila lateral de 44px; hover gris, selección azul suave con texto azul oscuro y peso 600. Árbol como listas anidadas y botones nativos: expandir/contraer separado de seleccionar; `aria-expanded` en ramas y sangría hija de 13px. Tab/Shift+Tab y Enter/Espacio usan comportamiento nativo; no afirmar navegación por flechas de un widget ARIA tree, que no está implementada.

Contrato sin router: `nodos`, `evaluaciones`, `activo`, `alSeleccionar`, `alRegresar`, `alCrearEvaluacion` y `alAbrirEvaluacion`. Navegación y datos llegan por props/eventos. Las tarjetas sin callback de apertura están deshabilitadas.

### Biblioteca y tarjetas
Estados diferenciados: vacío real; sin coincidencias por búsqueda o filtro; datos suministrados por props; cuadrícula/lista; biblioteca/recientes. «Recientes» ordena fechas descendentes; búsqueda filtra título y curso sin distinguir mayúsculas. Las etiquetas muestran Borrador/Calificada con fondo neutro, no inventan resultados. Fechas se presentan en es-PE y America/Lima.

Vacío real conserva el texto exacto: «Todavía no hay archivos. Todo está vacío y sin tareas pendientes.». Si no existe `alCrearEvaluacion`, el CTA dice «Preparar evaluación» o «Ver cómo preparar una evaluación», avisa «Creación de evaluaciones: próximamente.» y abre la guía informativa. No representa un CRUD funcional.

### Campos y configuración
Campos blancos de 43px, borde fino, radio de campo, padding lateral de 12px y label visible. API key en campo password; proveedor y modelo en select. Modelo deshabilitado hasta cargar modelos. Durante petición se deshabilitan controles; mostrar progreso, error mediante `role=alert` y confirmación mediante `role=status`. Cambiar credenciales invalida la verificación. El estado superior solo muestra check tras respuesta positiva; no confundir credencial recordada con conexión verificada.

Persistencia por sesión de forma predeterminada; recordar en el dispositivo requiere checkbox voluntario y advertencia. Panel de conexión desaparece tras verificar. Pestañas Conexión/Costos tienen roles tablist/tab/tabpanel y selección con subrayado azul; se activan con botones nativos, sin prometer soporte especial de flechas.

### Ventanas y drawer
Ventana centrada de 520px, máximo ancho disponible y alto `100dvh - 48px`; en móvil margen de 16px y alto `100dvh - 32px`. Scroll interno, cierre explícito, Escape o clic directo en velo. `role=dialog`, `aria-modal` y nombre accesible. En apertura enfoca primer control; Tab y Shift+Tab ciclan dentro; bloqueo de scroll y restitución de foco al cerrar.

Drawer móvil emplea el mismo patrón de Escape, ciclo de foco, bloqueo de scroll y restitución al activador; barra y main quedan `inert` mientras está abierto. El fondo cierra por clic y no entra en el recorrido Tab.

### Estimación
Dos columnas de campos numéricos y panel de resultado gris, con importe tabular. Tarifas manuales y supuestos visibles; estados inicial, calculando, error y resultado. La estimación no envía exámenes ni constituye cotización. Configuración y cálculo tienen solicitudes al servidor; CRUD, cliente Supabase y motor completo de lotes siguen pendientes de conexión en esta interfaz.

## Do's and Don'ts

### Do:
- **Do** preservar Google Groups: blanco, explorador gris, azul funcional y densidad contenida.
- **Do** mantener nombres accesibles, foco visible, recorrido de teclado y retorno de foco en capas.
- **Do** distinguir datos recibidos, vacío, búsqueda sin coincidencias y funciones pendientes.
- **Do** ampliar la biblioteca mediante props y eventos sin introducir enrutamiento.

### Don't:
- **Don't** inventar evaluaciones, notas, actividad o conexiones verificadas.
- **Don't** presentar el CTA provisional como creación o procesamiento ya integrado.
- **Don't** añadir una nueva identidad, métricas decorativas o tipografía ornamental.
- **Don't** usar el color como única señal de estado ni eliminar el foco por estética.
