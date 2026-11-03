import asyncio
from uuid import UUID
from urllib.parse import quote
from infraestructura.archivos import ExtraerDocumento


class DocumentosPrivados:
    def __init__(self, repositorio):
        self.repositorio = repositorio

    async def leer(self, ruta: str):
        if not ruta.startswith(str(self.repositorio.sesion.usuario_id)+'/') or '..' in ruta:
            raise ValueError('La ruta del archivo no pertenece a tu sesión')
        contenido = await self.repositorio.solicitar('GET','/storage/v1/object/authenticated/evaluaciones/'+quote(ruta,safe='/'),binario=True)
        return await asyncio.to_thread(ExtraerDocumento().extraer,ruta,contenido)

    async def contexto(self, evaluacion: dict):
        if not evaluacion['soluciones_profesor']:
            raise ValueError('Adjunta la solución oficial antes de continuar')
        archivos = evaluacion['soluciones_profesor'] + evaluacion['materiales_apoyo']
        return list(await asyncio.gather(*(self.leer(archivo['ruta_almacenamiento']) for archivo in archivos)))
