from typing import Annotated
from decimal import Decimal

from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from aplicacion.configuracion import ValidarConexionApi
from dominio.puertos import ErrorProveedor, IProveedorVisionIA
from presentacion.dependencias import obtener_proveedor
from aplicacion.costos import CalcularCostoEstimado, SolicitudCosto
from presentacion.esquemas import ConfiguracionIA, PeticionComprobarLote
from infraestructura.tarifas_ia import ServicioTarifasOficiales
from infraestructura.proveedores import ProveedorHTTP
from dominio.puertos import IGeneradorExcel
from dominio.calificacion import DetallePregunta, ExamenEstudiante
from aplicacion.reportes import GenerarReporteExcelNotas
from presentacion.dependencias import obtener_generador
from io import BytesIO
from presentacion.biblioteca import enrutador as biblioteca
from infraestructura.supabase import ErrorPersistencia, URL_SUPABASE, CLAVE_PUBLICABLE
from presentacion.evaluaciones import enrutador as evaluaciones
from presentacion.recepcion import enrutador as recepcion


aplicacion = FastAPI(title="Revisador", version="0.1.0")
aplicacion.include_router(biblioteca)
aplicacion.include_router(evaluaciones)
aplicacion.include_router(recepcion)


@aplicacion.exception_handler(ValueError)
async def manejar_datos(solicitud: Request, error: ValueError):
    return JSONResponse(status_code=422,content={'detalle':'No se pudo validar el archivo o los puntajes. Revisa la rúbrica y usa archivos válidos de hasta 3 MB y 20 páginas.'})


@aplicacion.exception_handler(TimeoutError)
async def manejar_tiempo(solicitud: Request, error: TimeoutError):
    return JSONResponse(status_code=504,content={'detalle':'El procesamiento tardó demasiado. Revisa el estado del examen antes de reintentarlo.'})


@aplicacion.get('/api/sistema')
def sistema():
    return {'supabase_url': URL_SUPABASE, 'clave_publicable': CLAVE_PUBLICABLE}


@aplicacion.exception_handler(ErrorPersistencia)
async def manejar_persistencia(solicitud: Request, error: ErrorPersistencia):
    return JSONResponse(status_code=error.estado, content={'detalle': error.detalle}, headers={'Cache-Control': 'no-store'})


@aplicacion.exception_handler(ErrorProveedor)
async def manejar_proveedor(solicitud: Request, error: ErrorProveedor):
    return JSONResponse(status_code=502, content={"detalle": str(error)}, headers={"Cache-Control": "no-store"})


@aplicacion.exception_handler(RequestValidationError)
async def manejar_validacion(solicitud: Request, error: RequestValidationError):
    return JSONResponse(status_code=422, content={"detalle": "Revisa los campos obligatorios y sus valores."})


@aplicacion.post("/api/configuracion/comprobar-api")
async def comprobar_api(configuracion: ConfiguracionIA, respuesta: Response, proveedor: Annotated[IProveedorVisionIA, Depends(obtener_proveedor)]):
    if not configuracion.modelo:
        return JSONResponse(status_code=422, content={"detalle": "Selecciona un modelo para comprobarlo."})
    await ValidarConexionApi(proveedor).ejecutar(configuracion.clave_api.get_secret_value(), configuracion.modelo)
    respuesta.headers["Cache-Control"] = "no-store"
    return {"verificada": True}


@aplicacion.post("/api/configuracion/modelos")
async def listar_modelos(configuracion: ConfiguracionIA, respuesta: Response, proveedor: Annotated[IProveedorVisionIA, Depends(obtener_proveedor)]) -> dict:
    modelos = await proveedor.listar_modelos(configuracion.clave_api.get_secret_value())
    respuesta.headers["Cache-Control"] = "no-store"
    return {"modelos": modelos}


@aplicacion.get("/api/configuracion/tarifas-oficiales")
async def tarifas_oficiales(proveedor: str = "gemini", modelo: str = "gemini-flash-lite-latest", respuesta: Response = None):
    servicio = ServicioTarifasOficiales()
    resultado = await servicio.obtener_tarifa(proveedor, modelo)
    if respuesta:
        respuesta.headers["Cache-Control"] = "public, max-age=1800"
    return resultado


@aplicacion.post("/api/configuracion/comprobar-lote")
async def comprobar_lote(peticion: PeticionComprobarLote, respuesta: Response):
    proveedor = ProveedorHTTP(peticion.proveedor)
    claves = [c.get_secret_value() for c in peticion.claves_api]
    resultados = await proveedor.comprobar_lote(claves, peticion.modelo)
    respuesta.headers["Cache-Control"] = "no-store"
    return {"resultados": resultados}


class PeticionCosto(BaseModel):
    cantidad_examenes: int = Field(ge=0, le=10000)
    tokens_solucion: int = Field(ge=0)
    tokens_materiales: int = Field(ge=0)
    tokens_indicaciones: int = Field(ge=0)
    tokens_imagen: int = Field(ge=0)
    tokens_retroalimentacion: int = Field(ge=0)
    tarifa_entrada: Decimal = Field(ge=0, allow_inf_nan=False)
    tarifa_salida: Decimal = Field(ge=0, allow_inf_nan=False)


@aplicacion.post("/api/evaluaciones/calcular-costo")
def calcular_costo(peticion: PeticionCosto) -> dict:
    resultado = CalcularCostoEstimado().ejecutar(SolicitudCosto(**peticion.model_dump()))
    return {"tokens_entrada": resultado.tokens_entrada, "tokens_salida": resultado.tokens_salida, "costo_usd": str(resultado.costo_usd)}


class PreguntaReporte(BaseModel):
    numero_pregunta: int = Field(gt=0)
    puntaje_obtenido: Decimal = Field(ge=0, allow_inf_nan=False)
    puntaje_maximo: Decimal = Field(ge=0, allow_inf_nan=False)
    respuesta_detectada: str = Field(default="nada", max_length=10000)
    justificacion: str = Field(min_length=1, max_length=10000)


class ExamenReporte(BaseModel):
    nombre_estudiante: str = Field(default="nada", max_length=255)
    codigo_estudiante: str = Field(default="nada", max_length=100)
    observaciones_generales: str = Field(default="", max_length=10000)
    preguntas: list[PreguntaReporte] = Field(max_length=200)


class PeticionReporte(BaseModel):
    contexto: dict[str, str]
    examenes: list[ExamenReporte] = Field(max_length=1000)


@aplicacion.post("/api/reportes/excel")
def exportar_excel(peticion: PeticionReporte, generador: Annotated[IGeneradorExcel, Depends(obtener_generador)]):
    try:
        examenes = tuple(ExamenEstudiante(examen.nombre_estudiante, examen.codigo_estudiante, tuple(DetallePregunta(**pregunta.model_dump()) for pregunta in examen.preguntas), examen.observaciones_generales) for examen in peticion.examenes)
        contenido = GenerarReporteExcelNotas(generador).ejecutar(peticion.contexto, examenes)
    except ValueError:
        return JSONResponse(status_code=422, content={"detalle": "Las preguntas contienen puntajes o numeración no válidos."})
    return StreamingResponse(BytesIO(contenido), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="Acta_Notas.xlsx"', "Cache-Control": "no-store"})
