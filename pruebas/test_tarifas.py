import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from infraestructura.tarifas_ia import ServicioTarifasOficiales


@pytest.mark.anyio
async def test_obtener_tarifas_oficiales_gemini():
    servicio = ServicioTarifasOficiales()
    # Debe devolver tarifas válidas para gemini-flash-lite-latest
    tarifas = await servicio.obtener_tarifa("gemini", "gemini-flash-lite-latest")
    assert isinstance(tarifas["tarifa_entrada"], Decimal)
    assert isinstance(tarifas["tarifa_salida"], Decimal)
    assert tarifas["tarifa_entrada"] > 0
    assert tarifas["tarifa_salida"] > 0
    assert "ai.google.dev" in tarifas["fuente"]


@pytest.mark.anyio
async def test_obtener_tarifas_con_fallback_si_falla_red():
    servicio = ServicioTarifasOficiales()
    # Simular fallo de red
    with patch("httpx.AsyncClient.get", side_effect=Exception("Fallo de red")):
        tarifas = await servicio.obtener_tarifa("gemini", "gemini-3.6-flash")
        assert tarifas["tarifa_entrada"] == Decimal("0.75")
        assert tarifas["tarifa_salida"] == Decimal("3.75")
        assert "respaldo" in tarifas["fuente"] or "oficial" in tarifas["fuente"]


@pytest.mark.anyio
async def test_obtener_tarifas_modelo_desconocido_no_inventa_precio():
    servicio = ServicioTarifasOficiales()
    with pytest.raises(ValueError, match="tarifa"):
        await servicio.obtener_tarifa("gemini", "modelo-nuevo-desconocido")
