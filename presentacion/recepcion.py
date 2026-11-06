import base64
import asyncio
import json
import os
import hmac
from io import BytesIO
from uuid import UUID, uuid4
from PIL import Image
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Header
from infraestructura.archivos import ExtraerDocumento, crear_pdf_fotos
from infraestructura.supabase import RepositorioSupabase, ErrorPersistencia

enrutador = APIRouter(prefix="/api/recepcion", tags=["recepcion_alumnos"])


async def leer_fotos(archivos: list[UploadFile], rotaciones: str) -> tuple[list[tuple[str, bytes]], list[int]]:
    if not 1 <= len(archivos) <= 20:
        raise HTTPException(422, 'Selecciona entre 1 y 20 fotos.')
    try:
        giros = json.loads(rotaciones)
        if not isinstance(giros, list) or any(type(giro) is not int for giro in giros):
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(422, 'Las rotaciones de las fotos no son válidas.') from None
    fotos = []
    total = 0
    for archivo in archivos:
        contenido = await archivo.read(3 * 1024 * 1024 + 1)
        total += len(contenido)
        if len(contenido) > 3 * 1024 * 1024 or total > 4 * 1024 * 1024:
            raise HTTPException(422, 'Las fotos superan el límite de carga. Reduce su tamaño e inténtalo de nuevo.')
        fotos.append((archivo.filename or '', contenido))
    return fotos, giros


@enrutador.post('/{token}/entregar-fotos')
async def entregar_fotos(token: UUID, nombre: str = Form(...), codigo: str = Form(...), archivos: list[UploadFile] = File(...), rotaciones: str = Form(...)):
    if not codigo.strip():
        raise HTTPException(422, 'El código de estudiante es obligatorio.')
    try:
        info = await RepositorioSupabase.rpc_publico('obtener_info_recepcion', {'p_token': str(token)})
    except ErrorPersistencia as error:
        raise HTTPException(error.estado, error.detalle) from None
    if not info or not info.get('recepcion_abierta'):
        raise HTTPException(423, 'La recepción de entregas para esta evaluación se encuentra cerrada.')
    fotos, giros = await leer_fotos(archivos, rotaciones)
    try:
        pdf = await asyncio.to_thread(crear_pdf_fotos, fotos, giros)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
    archivo = UploadFile(filename='examen.pdf', file=BytesIO(pdf))
    return await entregar_examen(token, nombre, codigo, archivo, 0)


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
    archivo: UploadFile = File(...),
    rotacion: int = Form(0),
):
    nombre_limpio = (nombre or "").strip()
    codigo_limpio = (codigo or "").strip()
    if not codigo_limpio:
        raise HTTPException(422, "El código de estudiante es obligatorio.")
    if rotacion not in (0, 90, 180, 270):
        raise HTTPException(422, "La rotación debe ser 0, 90, 180 o 270 grados.")

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
    contenido = await archivo.read(3 * 1024 * 1024 + 1)
    if len(contenido) > 3 * 1024 * 1024:
        raise HTTPException(422, "El archivo supera el tamaño máximo permitido de 3 MB.")

    try:
        doc = ExtraerDocumento().extraer(archivo.filename or "examen.jpg", contenido)
        if not doc.imagenes:
            raise ValueError("El documento no contiene imágenes legibles.")
    except ValueError as err:
        raise HTTPException(422, str(err)) from None

    # 3. Guardar imagen activa en storage público
    es_pdf = doc.tipo == 'pdf'
    imagen_bytes = contenido if es_pdf else base64.b64decode(doc.imagenes[0])
    if not es_pdf and rotacion:
        with Image.open(BytesIO(imagen_bytes)) as imagen:
            salida = BytesIO()
            imagen.rotate(-rotacion, expand=True).save(salida, format='JPEG', quality=85)
            imagen_bytes = salida.getvalue()
    evaluacion_id = info["evaluacion_id"]
    extension = 'pdf' if es_pdf else 'jpg'
    nombre_guardado = f"estudiantes/{evaluacion_id}/{uuid4().hex}.{extension}"

    try:
        await RepositorioSupabase.rpc_recepcion('reservar_archivo_entrega', {'p_token': str(token), 'p_ruta': nombre_guardado})
        ruta_storage = await RepositorioSupabase.subir_archivo_publico(
            nombre_guardado,
            imagen_bytes,
            tipo_mime="application/pdf" if es_pdf else "image/jpeg"
        )
    except ErrorPersistencia as err:
        raise HTTPException(err.estado, err.detalle) from None


    # 4. Registrar entrega atómicamente en la base de datos
    try:
        registro = await RepositorioSupabase.rpc_recepcion(
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
        if 400 <= err.estado < 500:
            try:
                await RepositorioSupabase.borrar_archivo_recepcion(ruta_storage)
            except ErrorPersistencia:
                pass
        raise HTTPException(err.estado, err.detalle) from None


@enrutador.get('/tareas/limpiar-archivos')
async def limpiar_archivos_pendientes(authorization: str | None = Header(default=None)):
    secreto = os.getenv('CRON_SECRET', '')
    recibido = authorization or ''
    if not secreto or not hmac.compare_digest(recibido, f'Bearer {secreto}'):
        raise HTTPException(401, 'No autorizado.')
    rutas = await RepositorioSupabase.rpc_recepcion('reclamar_limpieza_entregas', {'p_limite': 500})
    if rutas:
        await RepositorioSupabase.borrar_archivos_recepcion(rutas)
        await RepositorioSupabase.rpc_recepcion('confirmar_limpieza_entregas', {'p_rutas': rutas})
    return {'archivos_limpiados': len(rutas or [])}
