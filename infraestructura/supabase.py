"""Clientes por solicitud para sesiones docentes y recepción pública."""
import os
from decimal import Decimal
from dataclasses import dataclass
from uuid import UUID
import httpx


URL_SUPABASE = os.getenv('SUPABASE_URL', 'https://xjmglxauhhgrkcowqgjm.supabase.co')
CLAVE_PUBLICABLE = os.getenv('SUPABASE_CLAVE_PUBLICABLE', 'sb_publishable_FVEru-bcFesefpC6Bv4v_Q_A4iMuUw9')


class ErrorPersistencia(Exception):
    def __init__(self, detalle: str, estado: int = 503):
        self.detalle, self.estado = detalle, estado


@dataclass(frozen=True)
class SesionProfesor:
    usuario_id: UUID
    token: str


class RepositorioSupabase:
    def __init__(self, sesion: SesionProfesor):
        self.sesion = sesion

    async def solicitar(self, metodo: str, ruta: str, *, datos=None, contenido=None, cabeceras=None, binario=False):
        encabezados = {'apikey': CLAVE_PUBLICABLE, 'Authorization': f'Bearer {self.sesion.token}', 'Prefer': 'return=representation', **(cabeceras or {})}
        try:
            async with httpx.AsyncClient(timeout=35, follow_redirects=False) as cliente:
                respuesta = await cliente.request(metodo, URL_SUPABASE + ruta, headers=encabezados, json=datos, content=contenido)
        except httpx.HTTPError:
            raise ErrorPersistencia('No se pudo conectar con tu biblioteca. Inténtalo otra vez.') from None
        if respuesta.status_code >= 400:
            if respuesta.status_code in (401, 403):
                raise ErrorPersistencia('Tu sesión no tiene acceso o ha vencido. Vuelve a iniciar sesión.', 401)
            if respuesta.status_code == 409:
                raise ErrorPersistencia('El registro ya existe o está siendo procesado.', 409)
            if respuesta.status_code in (400, 404, 422):
                raise ErrorPersistencia('No se pudo guardar. Revisa los datos y el estado de la evaluación.', 422)
            raise ErrorPersistencia('El almacenamiento no está disponible. Inténtalo otra vez.')
        if binario:
            return respuesta.content
        return respuesta.json() if respuesta.content else None

    async def rpc(self, funcion: str, datos: dict):
        return await self.solicitar('POST', '/rest/v1/rpc/' + funcion, datos=datos)

    @classmethod
    async def solicitar_publico(cls, metodo: str, ruta: str, *, datos=None, contenido=None, cabeceras=None):
        encabezados = {'apikey': CLAVE_PUBLICABLE, 'Prefer': 'return=representation', **(cabeceras or {})}
        try:
            async with httpx.AsyncClient(timeout=35, follow_redirects=False) as cliente:
                respuesta = await cliente.request(metodo, URL_SUPABASE + ruta, headers=encabezados, json=datos, content=contenido)
        except httpx.HTTPError:
            raise ErrorPersistencia('No se pudo conectar con el portal de entregas. Inténtalo otra vez.') from None
        if respuesta.status_code >= 400:
            mensaje_servidor = None
            codigo_servidor = None
            try:
                cuerpo_error = respuesta.json()
                mensaje_servidor = cuerpo_error.get('message') or cuerpo_error.get('details')
                codigo_servidor = cuerpo_error.get('code')
            except Exception:
                pass
            estado = {'42300': 423, '42301': 423, '40900': 409, '40400': 404, '42200': 422}.get(codigo_servidor)
            if estado and mensaje_servidor:
                raise ErrorPersistencia(mensaje_servidor, estado)
            if respuesta.status_code >= 500:
                raise ErrorPersistencia('El servicio de entregas no está disponible.', 503)
            if mensaje_servidor:
                raise ErrorPersistencia(mensaje_servidor, 423 if respuesta.status_code == 423 else (409 if respuesta.status_code == 409 else 422))
            if respuesta.status_code == 404:
                raise ErrorPersistencia('Evaluación no encontrada o enlace de entrega inválido.', 404)
            if respuesta.status_code == 409:
                raise ErrorPersistencia('Ya has entregado este examen. Solicita autorización a tu docente para reenviar.', 409)
            if respuesta.status_code in (422, 423):
                raise ErrorPersistencia('La recepción de entregas está cerrada o el archivo no es válido.', 422)
            raise ErrorPersistencia('El servicio de entregas no está disponible.', 503)
        return respuesta.json() if respuesta.content else None

    @classmethod
    async def rpc_publico(cls, funcion: str, datos: dict):
        return await cls.solicitar_publico('POST', '/rest/v1/rpc/' + funcion, datos=datos)

    @staticmethod
    def clave_recepcion():
        clave = os.getenv('SUPABASE_CLAVE_SECRETA', '').strip()
        if not clave:
            raise ErrorPersistencia('La recepción de alumnos aún no está configurada en el servidor.', 503)
        return clave

    @classmethod
    def cabeceras_recepcion(cls):
        clave = cls.clave_recepcion()
        cabeceras = {'apikey': clave}
        if not clave.startswith('sb_secret_'):
            cabeceras['Authorization'] = f'Bearer {clave}'
        return cabeceras

    @classmethod
    async def rpc_recepcion(cls, funcion: str, datos: dict):
        return await cls.solicitar_publico('POST', '/rest/v1/rpc/' + funcion, datos=datos,
            cabeceras=cls.cabeceras_recepcion())

    @classmethod
    async def subir_archivo_publico(cls, ruta: str, contenido: bytes, tipo_mime: str = 'image/jpeg'):
        encabezados = {**cls.cabeceras_recepcion(), 'Content-Type': tipo_mime, 'x-upsert': 'false'}
        try:
            async with httpx.AsyncClient(timeout=35, follow_redirects=False) as cliente:
                respuesta = await cliente.post(
                    f'{URL_SUPABASE}/storage/v1/object/evaluaciones/{ruta}',
                    headers=encabezados,
                    content=contenido
                )
        except httpx.HTTPError:
            raise ErrorPersistencia('No se pudo subir el archivo de examen. Inténtalo otra vez.') from None
        if respuesta.status_code >= 400:
            raise ErrorPersistencia('No se pudo almacenar el archivo de examen.', 422)
        return ruta

    @classmethod
    async def borrar_archivo_recepcion(cls, ruta: str):
        await cls.solicitar_publico('DELETE', '/storage/v1/object/evaluaciones',
            datos={'prefixes': [ruta]}, cabeceras=cls.cabeceras_recepcion())

    @classmethod
    async def borrar_archivos_recepcion(cls, rutas: list[str]):
        for inicio in range(0, len(rutas), 1000):
            await cls.solicitar_publico('DELETE', '/storage/v1/object/evaluaciones',
                datos={'prefixes': rutas[inicio:inicio + 1000]}, cabeceras=cls.cabeceras_recepcion())

    async def evaluacion(self, identificador: UUID) -> dict:
        filas = await self.solicitar('GET', f'/rest/v1/evaluaciones?id=eq.{identificador}&select=*,cursos(*,promociones_ciclos(*,escuelas(*,facultades(*,anios_academicos(*))))),soluciones_profesor(*),materiales_apoyo(*),criterios_preguntas(*),examenes_estudiantes(*,detalles_preguntas(*,puntaje_maximo,numero_pregunta),historial_entregas_estudiantes(*))')
        if not filas:
            raise ErrorPersistencia('Evaluación no encontrada en tu biblioteca.', 404)
        evaluacion = filas[0]
        if evaluacion.get('eliminando'):
            raise ErrorPersistencia('Esta evaluación tiene una eliminación pendiente. Vuelve a la biblioteca para reintentarla.', 409)
        solucion = evaluacion.get('soluciones_profesor')
        evaluacion['soluciones_profesor'] = solucion if isinstance(solucion, list) else [solucion] if solucion else []
        for relacion in ('materiales_apoyo', 'criterios_preguntas', 'examenes_estudiantes'):
            evaluacion[relacion] = evaluacion.get(relacion) or []
        for examen in evaluacion['examenes_estudiantes']:
            examen['detalles_preguntas'] = examen.get('detalles_preguntas') or []
            examen['historial_entregas_estudiantes'] = sorted(
                examen.get('historial_entregas_estudiantes') or [],
                key=lambda h: h.get('numero_entrega', 1)
            )
            examen['nota_final'] = float(sum((Decimal(str(detalle['puntaje_obtenido'])) for detalle in examen['detalles_preguntas']), Decimal('0')))
            if examen['historial_entregas_estudiantes']:
                ultima = examen['historial_entregas_estudiantes'][-1]
                examen['numero_entregas'] = ultima['numero_entrega']
                examen['ruta_imagen_examen'] = ultima['ruta_archivo']
        return evaluacion
