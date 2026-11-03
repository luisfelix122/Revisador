from typing import Annotated
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from infraestructura.supabase import RepositorioSupabase
from presentacion.seguridad import obtener_repositorio

enrutador = APIRouter(prefix='/api', tags=['Biblioteca'])
Repositorio = Annotated[RepositorioSupabase, Depends(obtener_repositorio)]


@enrutador.get('/biblioteca')
async def biblioteca(repositorio: Repositorio):
    return await repositorio.solicitar('GET', '/rest/v1/anios_academicos?select=*,facultades(*,escuelas(*,promociones_ciclos(*,cursos(*,evaluaciones(*,examenes_estudiantes(id,nota_final,estado_revision))))))&order=anio.desc')


Nivel = Literal['anios_academicos', 'facultades', 'escuelas', 'promociones_ciclos', 'cursos']
PADRES = {'facultades': 'anio_academico_id', 'escuelas': 'facultad_id', 'promociones_ciclos': 'escuela_id', 'cursos': 'promocion_ciclo_id'}


class NuevoNodo(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    padre_id: UUID | None = None


@enrutador.post('/biblioteca/{nivel}')
async def crear_nodo(nivel: Nivel, peticion: NuevoNodo, repositorio: Repositorio):
    nombre = peticion.nombre.strip()
    if not nombre:
        raise HTTPException(422, 'Escribe un nombre.')
    if nivel == 'anios_academicos':
        if not nombre.isdigit() or not 1900 <= int(nombre) <= 2200:
            raise HTTPException(422, 'El año debe estar entre 1900 y 2200.')
        datos = {'anio': int(nombre)}
    else:
        if peticion.padre_id is None:
            raise HTTPException(422, 'Selecciona el nivel superior.')
        datos = {PADRES[nivel]: str(peticion.padre_id), 'denominacion' if nivel == 'promociones_ciclos' else 'nombre': nombre}
    filas = await repositorio.solicitar('POST', '/rest/v1/' + nivel, datos=datos)
    return filas[0]


class NuevaEvaluacion(BaseModel):
    curso_id: UUID
    titulo: str = Field(min_length=1, max_length=255)
    indicaciones_profesor: str = Field(default='', max_length=10000)
    puntaje_total_maximo: float = Field(default=20, gt=0, le=100, allow_inf_nan=False)


@enrutador.post('/evaluaciones')
async def crear_evaluacion(peticion: NuevaEvaluacion, repositorio: Repositorio):
    if not peticion.titulo.strip():
        raise HTTPException(422, 'Escribe el título de la evaluación.')
    filas = await repositorio.solicitar('POST', '/rest/v1/evaluaciones', datos=peticion.model_dump(mode='json'))
    return filas[0]


@enrutador.get('/evaluaciones/{identificador}')
async def ver_evaluacion(identificador: UUID, repositorio: Repositorio):
    return await repositorio.evaluacion(identificador)
