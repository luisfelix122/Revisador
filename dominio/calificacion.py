from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class DetallePregunta:
    numero_pregunta: int
    puntaje_obtenido: Decimal
    puntaje_maximo: Decimal
    respuesta_detectada: str
    justificacion: str

    def __post_init__(self):
        if self.numero_pregunta < 1:
            raise ValueError("El número de pregunta debe ser positivo")
        if not self.puntaje_obtenido.is_finite() or not self.puntaje_maximo.is_finite():
            raise ValueError("Los puntajes deben ser finitos")
        if any(puntaje != puntaje.quantize(Decimal('0.01')) for puntaje in (self.puntaje_obtenido,self.puntaje_maximo)):
            raise ValueError('Usa como máximo dos decimales en los puntajes')
        if not Decimal("0") <= self.puntaje_obtenido <= self.puntaje_maximo:
            raise ValueError("El puntaje debe estar entre cero y el máximo")
        if self.respuesta_detectada.strip().casefold() in ('', 'nada'):
            object.__setattr__(self, "respuesta_detectada", "nada")
        if self.respuesta_detectada == "nada":
            object.__setattr__(self, "puntaje_obtenido", Decimal("0"))


@dataclass(frozen=True)
class ExamenEstudiante:
    nombre_estudiante: str
    codigo_estudiante: str
    preguntas: tuple[DetallePregunta, ...]
    observaciones_generales: str

    def __post_init__(self):
        numeros = tuple(pregunta.numero_pregunta for pregunta in self.preguntas)
        if len(set(numeros)) != len(numeros):
            raise ValueError("Un examen no puede repetir preguntas")
        object.__setattr__(self, "nombre_estudiante", self.nombre_estudiante.strip() or "nada")
        object.__setattr__(self, "codigo_estudiante", self.codigo_estudiante.strip() or "nada")

    @property
    def nota_final(self) -> Decimal:
        return sum((pregunta.puntaje_obtenido for pregunta in self.preguntas), Decimal("0"))
