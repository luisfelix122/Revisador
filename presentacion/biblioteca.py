from typing import Annotated
from typing import Literal
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
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


@enrutador.delete('/biblioteca/{nivel}/{identificador}')
async def eliminar_nodo(nivel: Nivel, identificador: UUID, repositorio: Repositorio):
    resultado = await repositorio.rpc('eliminar_nodo_vacio', {'p_nivel': nivel, 'p_id': str(identificador)})
    if not resultado.get('eliminado'):
        raise HTTPException(409, resultado.get('detalle', 'No se pudo eliminar el elemento.'))
    return resultado


class CambioNombre(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)


@enrutador.patch('/biblioteca/{nivel}/{identificador}')
async def renombrar_nodo(nivel: Nivel, identificador: UUID, peticion: CambioNombre, repositorio: Repositorio):
    nombre = peticion.nombre.strip()
    if not nombre or len(nombre) > 100:
        raise HTTPException(422, 'Escribe un nombre de hasta 100 caracteres.')
    if nivel == 'anios_academicos':
        if not nombre.isdigit() or not 1900 <= int(nombre) <= 2200:
            raise HTTPException(422, 'El año debe estar entre 1900 y 2200.')
        datos = {'anio': int(nombre)}
    else:
        datos = {'denominacion' if nivel == 'promociones_ciclos' else 'nombre': nombre}
    filas = await repositorio.solicitar('PATCH', f'/rest/v1/{nivel}?id=eq.{identificador}', datos=datos)
    if not filas:
        raise HTTPException(404, 'Elemento no encontrado en tu biblioteca.')
    return filas[0]


class NuevaEvaluacion(BaseModel):
    curso_id: UUID
    titulo: str = Field(min_length=1, max_length=255)
    indicaciones_profesor: str = Field(default='', max_length=10000)
    puntaje_total_maximo: float = Field(default=20, gt=0, le=100, allow_inf_nan=False)

    @field_validator('puntaje_total_maximo')
    @classmethod
    def validar_decimales(cls, puntaje: float) -> float:
        valor = Decimal(str(puntaje))
        if valor != valor.quantize(Decimal('0.01')):
            raise ValueError('Usa como máximo dos decimales en el puntaje')
        return puntaje


@enrutador.post('/evaluaciones')
async def crear_evaluacion(peticion: NuevaEvaluacion, repositorio: Repositorio):
    if not peticion.titulo.strip():
        raise HTTPException(422, 'Escribe el título de la evaluación.')
    filas = await repositorio.solicitar('POST', '/rest/v1/evaluaciones', datos=peticion.model_dump(mode='json'))
    return filas[0]


@enrutador.get('/evaluaciones/{identificador}')
async def ver_evaluacion(identificador: UUID, repositorio: Repositorio):
    return await repositorio.evaluacion(identificador)


@enrutador.patch('/evaluaciones/{identificador}')
async def renombrar_evaluacion(identificador: UUID, peticion: CambioNombre, repositorio: Repositorio):
    nombre = peticion.nombre.strip()
    if not nombre:
        raise HTTPException(422, 'Escribe el título de la evaluación.')
    return await repositorio.rpc('renombrar_evaluacion', {'p_evaluacion': str(identificador), 'p_titulo': nombre})


@enrutador.delete('/evaluaciones/{identificador}')
async def eliminar_evaluacion(identificador: UUID, repositorio: Repositorio):
    repositorio.clave_recepcion()
    resultado = await repositorio.rpc('iniciar_eliminacion_evaluacion', {'p_evaluacion': str(identificador)})
    if not resultado.get('iniciado'):
        raise HTTPException(409, resultado.get('detalle', 'No se pudo eliminar la evaluación.'))
    await repositorio.borrar_archivos_recepcion(resultado.get('rutas', []))
    return await repositorio.rpc_recepcion('finalizar_eliminacion_evaluacion', {
        'p_evaluacion': str(identificador), 'p_propietario': str(repositorio.sesion.usuario_id),
    })
