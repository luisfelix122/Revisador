from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PreguntaCriterio(BaseModel):
    model_config = ConfigDict(extra='forbid')
    numero_pregunta: int = Field(ge=1,le=100)
    puntaje_maximo: float = Field(gt=0,le=100,allow_inf_nan=False)
    respuesta_esperada: str = Field(min_length=1,max_length=10000)

    @field_validator('puntaje_maximo')
    @classmethod
    def validar_decimales(cls, puntaje: float) -> float:
        valor = Decimal(str(puntaje))
        if valor != valor.quantize(Decimal('0.01')):
            raise ValueError('Usa como máximo dos decimales en los puntajes')
        return puntaje


class SalidaRubrica(BaseModel):
    model_config = ConfigDict(extra='forbid')
    preguntas: list[PreguntaCriterio] = Field(min_length=1,max_length=100)


class PreguntaCalificada(BaseModel):
    model_config = ConfigDict(extra='forbid')
    numero_pregunta: int = Field(ge=1,le=100)
    puntaje_obtenido: float = Field(ge=0,le=100,allow_inf_nan=False)
    puntaje_maximo: float = Field(ge=0,le=100,allow_inf_nan=False)
    respuesta_detectada: str = Field(max_length=10000)
    justificacion: str = Field(min_length=1,max_length=10000)


class SalidaCalificacion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    nombre_estudiante: str = Field(max_length=255)
    codigo_estudiante: str = Field(max_length=100)
    observaciones_generales: str = Field(max_length=10000)
    preguntas: list[PreguntaCalificada] = Field(min_length=1,max_length=100)
