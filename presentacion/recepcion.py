import base64
from io import BytesIO
from uuid import UUID, uuid4
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from infraestructura.archivos import ExtraerDocumento
from infraestructura.supabase import RepositorioSupabase, ErrorPersistencia

enrutador = APIRouter(prefix="/api/recepcion", tags=["recepcion_alumnos"])


@enrutador.get("/{token}")
async def info_recepcion(token: UUID):
    try:
        resultado = await RepositorioSupabase.rpc_publico(
            "obtener_info_recepcion",
            {"p_token": str(token)}
        )
        if not resultado:
            raise HTTPException(404, "Evaluación no encontrada")
        return resultado
    except ErrorPersistencia as err:
        raise HTTPException(err.estado, err.detalle) from None


@enrutador.post("/{token}/entregar")
async def entregar_examen(
    token: UUID,
    nombre: str = Form(...),
    codigo: str = Form(...),
    archivo: UploadFile = File(...)
):
    nombre_limpio = (nombre or "").strip()
    codigo_limpio = (codigo or "").strip()
    if not codigo_limpio:
        raise HTTPException(422, "El código de estudiante es obligatorio.")

    # 1. Obtener información de la evaluación
    try:
        info = await RepositorioSupabase.rpc_publico(
            "obtener_info_recepcion",
            {"p_token": str(token)}
        )
    except ErrorPersistencia as err:
        raise HTTPException(err.estado, err.detalle) from None

    if not info or not info.get("recepcion_abierta"):
        raise HTTPException(423, "La recepción de entregas para esta evaluación se encuentra cerrada.")

    # 2. Leer y procesar archivo (validación segura de tamaño y formato)
    contenido = await archivo.read()
    if len(contenido) > 3 * 1024 * 1024:
        raise HTTPException(422, "El archivo supera el tamaño máximo permitido de 3 MB.")

    try:
        doc = ExtraerDocumento().extraer(archivo.filename or "examen.jpg", contenido)
        if not doc.imagenes:
            raise ValueError("El documento no contiene imágenes legibles.")
    except ValueError as err:
        raise HTTPException(422, str(err)) from None

    # 3. Guardar imagen activa en storage público
    primera_imagen_b64 = doc.imagenes[0]
    imagen_bytes = base64.b64decode(primera_imagen_b64)
    evaluacion_id = info["evaluacion_id"]
    nombre_guardado = f"estudiantes/{evaluacion_id}/{codigo_limpio}_{uuid4().hex[:8]}.jpg"

    try:
        ruta_storage = await RepositorioSupabase.subir_archivo_publico(
            nombre_guardado,
            imagen_bytes,
            tipo_mime="image/jpeg"
        )
    except ErrorPersistencia as err:
        raise HTTPException(err.estado, err.detalle) from None

    # 4. Registrar entrega atómicamente en la base de datos
    try:
        registro = await RepositorioSupabase.rpc_publico(
            "registrar_entrega_estudiante",
            {
                "p_token": str(token),
                "p_nombre": nombre_limpio,
                "p_codigo": codigo_limpio,
                "p_ruta": ruta_storage
            }
        )
        return registro
    except ErrorPersistencia as err:
        raise HTTPException(err.estado, err.detalle) from None
