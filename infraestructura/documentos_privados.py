import asyncio
from io import BytesIO
from uuid import UUID
from urllib.parse import quote
from pypdf import PdfReader
from infraestructura.archivos import ExtraerDocumento


class DocumentosPrivados:
    def __init__(self, repositorio):
        self.repositorio = repositorio

    async def leer(self, ruta: str):
        es_propio = ruta.startswith(str(self.repositorio.sesion.usuario_id)+'/')
        es_estudiante = ruta.startswith('estudiantes/')
        if not (es_propio or es_estudiante) or '..' in ruta:
            raise ValueError('La ruta del archivo no pertenece a tu sesión')
        contenido = await self.repositorio.solicitar('GET','/storage/v1/object/authenticated/evaluaciones/'+quote(ruta,safe='/'),binario=True)
        return await asyncio.to_thread(ExtraerDocumento().extraer,ruta,contenido)

    async def contexto(self, evaluacion: dict):
        if not evaluacion['soluciones_profesor']:
            raise ValueError('Adjunta la solución oficial antes de continuar')
        archivos = evaluacion['soluciones_profesor'] + evaluacion['materiales_apoyo']
        return list(await asyncio.gather(*(self.leer(archivo['ruta_almacenamiento']) for archivo in archivos)))

    async def contar_paginas_examenes(self, examenes: list[dict]) -> int:
        limite = asyncio.Semaphore(4)
        async def contar(examen: dict) -> int:
            ruta = examen['ruta_imagen_examen']
            if not ruta.lower().endswith('.pdf'):
                return 1
            if '..' in ruta:
                raise ValueError('Ruta inválida')
            async with limite:
                contenido = await self.repositorio.solicitar('GET', '/storage/v1/object/authenticated/evaluaciones/' + quote(ruta, safe='/'), binario=True)
            def leer_paginas():
                lector = PdfReader(BytesIO(contenido))
                if lector.is_encrypted or not 1 <= len(lector.pages) <= 20:
                    raise ValueError('PDF no disponible para estimación')
                return len(lector.pages)
            return await asyncio.to_thread(leer_paginas)
        return sum(await asyncio.gather(*(contar(examen) for examen in examenes)))
