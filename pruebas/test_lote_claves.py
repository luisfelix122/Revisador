import pytest
from unittest.mock import patch
from infraestructura.proveedores import ProveedorHTTP, ErrorTemporalProveedor
from dominio.puertos import ErrorProveedor


@pytest.mark.anyio
async def test_comprobar_lote_claves():
    proveedor = ProveedorHTTP("gemini")
    claves = ["clave_valida_1", "clave_invalida_2", "clave_valida_3"]

    async def mock_comprobar(clave: str, modelo: str):
        if "invalida" in clave:
            raise ErrorProveedor("Clave inválida o sin permisos para el modelo.")
        return None

    with patch.object(proveedor, "comprobar", side_effect=mock_comprobar):
        resultados = await proveedor.comprobar_lote(claves, "gemini-flash-lite-latest")
        assert len(resultados) == 3
        assert resultados[0]["valida"] is True
        assert resultados[0]["clave"] == "clave_valida_1"
        assert resultados[1]["valida"] is False
        assert "inválida" in resultados[1]["detalle"].lower()
        assert resultados[2]["valida"] is True


@pytest.mark.anyio
async def test_comprobar_lote_clave_vacia():
    proveedor = ProveedorHTTP("gemini")
    resultados = await proveedor.comprobar_lote([], "gemini-flash-lite-latest")
    assert resultados == []
