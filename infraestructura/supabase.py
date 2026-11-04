"""Cliente por solicitud: nunca usa service_role ni comparte sesiones."""
import os
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

    async def evaluacion(self, identificador: UUID) -> dict:
        filas = await self.solicitar('GET', f'/rest/v1/evaluaciones?id=eq.{identificador}&select=*,cursos(*,promociones_ciclos(*,escuelas(*,facultades(*,anios_academicos(*))))),soluciones_profesor(*),materiales_apoyo(*),criterios_preguntas(*),examenes_estudiantes(*,detalles_preguntas(*))')
        if not filas:
            raise ErrorPersistencia('Evaluación no encontrada en tu biblioteca.', 404)
        evaluacion = filas[0]
        solucion = evaluacion.get('soluciones_profesor')
        evaluacion['soluciones_profesor'] = solucion if isinstance(solucion, list) else [solucion] if solucion else []
        for relacion in ('materiales_apoyo', 'criterios_preguntas', 'examenes_estudiantes'):
            evaluacion[relacion] = evaluacion.get(relacion) or []
        for examen in evaluacion['examenes_estudiantes']:
            examen['detalles_preguntas'] = examen.get('detalles_preguntas') or []
        return evaluacion
