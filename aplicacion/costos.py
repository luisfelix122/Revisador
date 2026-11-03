from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class SolicitudCosto:
    cantidad_examenes: int
    tokens_solucion: int
    tokens_materiales: int
    tokens_indicaciones: int
    tokens_imagen: int
    tokens_retroalimentacion: int
    tarifa_entrada: Decimal
    tarifa_salida: Decimal

    def __post_init__(self):
        cantidades = (self.cantidad_examenes, self.tokens_solucion, self.tokens_materiales, self.tokens_indicaciones, self.tokens_imagen, self.tokens_retroalimentacion)
        if any(cantidad < 0 for cantidad in cantidades):
            raise ValueError("Las cantidades no pueden ser negativas")
        for tarifa in (self.tarifa_entrada, self.tarifa_salida):
            if not tarifa.is_finite() or tarifa < 0:
                raise ValueError("La tarifa debe ser finita y no negativa")


@dataclass(frozen=True)
class EstimacionCosto:
    tokens_entrada: int
    tokens_salida: int
    costo_usd: Decimal


class CalcularCostoEstimado:
    def ejecutar(self, solicitud: SolicitudCosto) -> EstimacionCosto:
        contexto = solicitud.tokens_solucion + solicitud.tokens_materiales + solicitud.tokens_indicaciones + solicitud.tokens_imagen
        entrada = contexto * solicitud.cantidad_examenes
        salida = solicitud.tokens_retroalimentacion * solicitud.cantidad_examenes
        costo = (entrada * solicitud.tarifa_entrada + salida * solicitud.tarifa_salida) / Decimal("1000000")
        return EstimacionCosto(entrada, salida, costo)
