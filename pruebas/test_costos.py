from decimal import Decimal
import pytest

from aplicacion.costos import CalcularCostoEstimado, SolicitudCosto


def test_debe_repetir_contexto_por_alumno_y_aplicar_tarifas_por_millon():
    solicitud = SolicitudCosto(2, 1000, 500, 100, 2000, 300, Decimal("1"), Decimal("2"))
    resultado = CalcularCostoEstimado().ejecutar(solicitud)
    assert resultado.tokens_entrada == 7200
    assert resultado.tokens_salida == 600
    assert resultado.costo_usd == Decimal("0.0084")


@pytest.mark.parametrize("cantidad,tarifa", [(-1, "1"), (1, "-1"), (1, "NaN")])
def test_debe_rechazar_cantidades_y_tarifas_invalidas(cantidad, tarifa):
    with pytest.raises(ValueError):
        SolicitudCosto(cantidad, 1, 0, 0, 1, 1, Decimal(tarifa), Decimal("1"))
