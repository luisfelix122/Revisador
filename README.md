# Revisador

Aplicación para profesores. Primera entrega incremental según los seis PRP de `docs/prp/`.

## Iniciar en Windows

Desde esta carpeta, en dos terminales:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn presentacion.api:aplicacion --reload --host 127.0.0.1 --port 8000
```

```powershell
npm ci
npm run dev
```

Frontend: http://127.0.0.1:5173. API documentada: http://127.0.0.1:8000/docs.

## Verificación

```powershell
.venv/Scripts/python -m pytest -q
npm test
npm run build
```

Las pruebas usan dobles únicamente en la frontera de proveedores externos; no consumen saldo de IA. Se observaron los fallos antes de implementar cada funcionalidad inicial. Interfaces acordadas: dominio, HTTP, archivo Excel y UI.

## Disponible

- UI React + Tailwind v4, Google Groups, Inter autoalojada, escritorio y móvil.
- Explorador desacoplado: `nodos`, `activo`, `alSeleccionar`, `alRegresar`; sin router ni reescritura de navegación.
- Biblioteca vacía real; tarjetas/lista, búsqueda y filtros con evaluaciones recibidas mediante props. No se fabrican resultados.
- Consulta dinámica de modelos OpenAI/Gemini y comprobación real del modelo. Una comprobación puede consumir saldo. Algunos modelos del catálogo pueden no admitir el endpoint de generación utilizado.
- Clave en `sessionStorage`, `localStorage` solo con consentimiento. El check nunca se restaura desde almacenamiento y se invalida al editar.
- Resumen previo a la calificación: estimación para el modelo y los exámenes seleccionados cuando hay tarifas disponibles. No es una garantía de facturación.
- Dominio con `Decimal`, respuesta ausente `nada`/cero y suma de nota derivada.
- Exportación HTTP Excel con acta, desglose, fórmulas y protección contra fórmulas inyectadas mediante nombres.
- Supabase remoto: diez tablas y políticas RLS, propietario en la raíz académica.

## Flujo implementado y límites

- Inicio de sesión con Supabase Auth y explorador académico privado.
- Creación de evaluaciones, subida privada de archivos, extracción de documentos y rúbrica editable.
- Calificación por examen, estimación con tarifas introducidas por el docente, revisión y exportación Excel.
- La estimación no es un tarifario oficial ni una garantía de facturación. Los resultados de IA requieren revisión docente.
- La generación real con Gemini y el despliegue aún no se han verificado satisfactoriamente.

## Supabase

La recepción de alumnos requiere configurar `SUPABASE_CLAVE_SECRETA` únicamente en el entorno del servidor con una clave secreta del proyecto Supabase. Nunca debe añadirse al frontend, al repositorio ni a un archivo público. La API usa esa credencial exclusivamente para subir y registrar entregas; ante un rechazo confirmado intenta limpiar el archivo. El bucket permanece privado y el docente accede mediante su sesión. Sin esta variable, la API rechaza las entregas con un error de configuración. Las migraciones de recepción y restricción de funciones ya se aplicaron en el proyecto remoto; para otras bases deben aplicarse las migraciones locales correspondientes.

Proyecto separado **revisador** (`xjmglxauhhgrkcowqgjm`), región São Paulo, creado con costo indicado de 0 USD/mes confirmado por el usuario. Migraciones aplicadas: `20261103221122_biblioteca_academica_3nf.sql` y `20261103223437_flujo_completo_seguro.sql`.

El año es único por profesor, no globalmente. Los descendientes heredan acceso mediante la visibilidad RLS de su padre, sin repetir el propietario en cada tabla. El navegador no utiliza claves privilegiadas. La escritura de archivos y resultados utiliza operaciones transaccionales que comprueban la propiedad.

El asesor de seguridad no encontró incidencias. El asesor de rendimiento informa índices aún sin uso porque la base es nueva; se conservan los índices de claves foráneas. [Explicación del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Vercel

La cuenta está conectada y el proyecto **revisador** (`prj_IohAhnVLeetG1nHHf52LPjrLdUIX`) está publicado en Vercel. Los servicios de Vite y FastAPI se configuran en `vercel.json`. Los lotes grandes requerirán un trabajador duradero, no tareas en memoria dentro de una función.

Referencias consultadas: [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi), [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [modelos Gemini](https://ai.google.dev/api/models), [Responses de OpenAI](https://developers.openai.com/api/docs/guides/text).

## Revisión y límites

Se inicializó Git y se inició la revisión acotada. Los cambios posteriores requieren recuperar la revisión y validar el recibo antes de publicar. El detector visual funcionó en modo degradado por falta de sus módulos de análisis: su salida vacía no certifica accesibilidad ni contraste.
