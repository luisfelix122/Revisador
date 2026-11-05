from fastapi.testclient import TestClient

from presentacion.api import aplicacion
from presentacion.dependencias import obtener_proveedor
import httpx


class ProveedorPrueba:
    async def comprobar(self, clave, modelo):
        return None

    async def listar_modelos(self, clave):
        return ["modelo-de-prueba"]


def test_debe_rechazar_clave_vacia_sin_devolver_el_valor_recibido():
    respuesta = TestClient(aplicacion).post("/api/configuracion/comprobar-api", json={"proveedor": "openai", "clave_api": "", "modelo": "ejemplo"})
    assert respuesta.status_code == 422
    assert "input" not in respuesta.text


def test_debe_mostrar_check_cuando_api_es_valida():
    aplicacion.dependency_overrides[obtener_proveedor] = lambda: ProveedorPrueba()
    try:
        respuesta = TestClient(aplicacion).post("/api/configuracion/comprobar-api", json={"proveedor": "openai", "clave_api": "clave-prueba", "modelo": "modelo-de-prueba"})
        assert respuesta.json() == {"verificada": True}
        assert respuesta.headers["cache-control"] == "no-store"
        assert "clave-prueba" not in respuesta.text
    finally:
        aplicacion.dependency_overrides.clear()


def test_debe_calcular_costo_desde_http():
    respuesta = TestClient(aplicacion).post("/api/evaluaciones/calcular-costo", json={"cantidad_examenes": 2, "tokens_solucion": 1000, "tokens_materiales": 500, "tokens_indicaciones": 100, "tokens_imagen": 2000, "tokens_retroalimentacion": 300, "tarifa_entrada": "1", "tarifa_salida": "2"})
    assert respuesta.status_code == 200
    assert respuesta.json()["costo_usd"] == "0.0084"


def test_debe_listar_modelos_del_proveedor_sin_imponer_uno():
    aplicacion.dependency_overrides[obtener_proveedor] = lambda: ProveedorPrueba()
    try:
        respuesta = TestClient(aplicacion).post("/api/configuracion/modelos", json={"proveedor": "gemini", "clave_api": "clave-prueba"})
        assert respuesta.status_code == 200
        assert respuesta.json() == {"modelos": ["modelo-de-prueba"]}
    finally:
        aplicacion.dependency_overrides.clear()


def test_debe_leer_proveedor_del_cuerpo_y_sanear_error_remoto(monkeypatch):
    async def responder(cliente, metodo, url, **opciones):
        assert url == 'https://generativelanguage.googleapis.com/v1beta/models'
        assert opciones['headers']['x-goog-api-key'] == 'clave-secreta-prueba'
        return httpx.Response(429, json={'error': 'clave-secreta-prueba'})
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    respuesta = TestClient(aplicacion).post('/api/configuracion/modelos', json={'proveedor': 'gemini', 'clave_api': 'clave-secreta-prueba'})
    assert respuesta.status_code == 502
    assert 'Cuota agotada' in respuesta.text
    assert 'clave-secreta-prueba' not in respuesta.text


def test_debe_descargar_excel_por_http():
    respuesta = TestClient(aplicacion).post('/api/reportes/excel', json={'contexto': {'curso': 'Álgebra'}, 'examenes': []})
    assert respuesta.status_code == 200
    assert respuesta.content[:2] == b'PK'
    assert 'spreadsheetml' in respuesta.headers['content-type']


def test_error_openai_no_recomienda_modelos_de_google(monkeypatch):
    async def responder(cliente, metodo, url, **opciones):
        return httpx.Response(503, json={'error':'fallo temporal'})
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    respuesta = TestClient(aplicacion).post('/api/configuracion/modelos', json={'proveedor':'openai','clave_api':'clave-prueba'})
    assert respuesta.status_code == 502
    assert 'Google' not in respuesta.text
    assert 'gemini' not in respuesta.text.lower()


def test_debe_obtener_tarifas_oficiales_dinamicas():
    respuesta = TestClient(aplicacion).get('/api/configuracion/tarifas-oficiales?proveedor=gemini&modelo=gemini-flash-lite-latest')
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos['proveedor'] == 'gemini'
    assert datos['modelo'] == 'gemini-flash-lite-latest'
    assert float(datos['tarifa_entrada']) > 0
    assert float(datos['tarifa_salida']) > 0
    assert 'ai.google.dev' in datos['fuente']


def test_debe_comprobar_lote_de_claves(monkeypatch):
    from infraestructura.proveedores import ProveedorHTTP
    async def mock_comprobar_lote(self, claves, modelo):
        return [{"clave": c, "valida": True, "detalle": "OK"} for c in claves]
    monkeypatch.setattr(ProveedorHTTP, "comprobar_lote", mock_comprobar_lote)

    respuesta = TestClient(aplicacion).post('/api/configuracion/comprobar-lote', json={
        'proveedor': 'gemini',
        'claves_api': ['clave_1', 'clave_2'],
        'modelo': 'gemini-flash-lite-latest'
    })
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert len(datos['resultados']) == 2
    assert datos['resultados'][0]['valida'] is True
    assert respuesta.headers['cache-control'] == 'no-store'

