from fastapi.testclient import TestClient

from presentacion.api import aplicacion
from presentacion.dependencias import obtener_proveedor
import httpx


def test_eliminar_nodo_solicita_borrado_seguro_del_elemento():
    from uuid import uuid4
    from unittest.mock import AsyncMock
    from presentacion.seguridad import obtener_repositorio
    identificador = str(uuid4())
    repositorio = type('RepositorioPrueba', (), {'rpc': AsyncMock(return_value={'eliminado': True})})()
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).delete(f'/api/biblioteca/facultades/{identificador}')
        assert respuesta.status_code == 200
        repositorio.rpc.assert_awaited_once_with('eliminar_nodo_vacio', {'p_nivel':'facultades', 'p_id':identificador})
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_eliminar_nodo_con_descendientes_muestra_motivo():
    from uuid import uuid4
    from unittest.mock import AsyncMock
    from presentacion.seguridad import obtener_repositorio
    repositorio = type('RepositorioPrueba', (), {'rpc': AsyncMock(return_value={'eliminado': False, 'detalle': 'Vacía este nivel primero.'})})()
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).delete(f'/api/biblioteca/cursos/{uuid4()}')
        assert respuesta.status_code == 409
        assert respuesta.json()['detail'] == 'Vacía este nivel primero.'
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_preparacion_usa_tarifa_del_modelo_seleccionado(monkeypatch):
    from uuid import uuid4
    from unittest.mock import AsyncMock
    from presentacion.seguridad import obtener_repositorio
    from infraestructura.tarifas_ia import ServicioTarifasOficiales

    identificador = str(uuid4())
    evaluacion = {'id': identificador, 'puntaje_total_maximo': 20, 'indicaciones_profesor': '',
        'soluciones_profesor': [{'ruta_almacenamiento': 'solucion', 'cantidad_paginas': 1}],
        'materiales_apoyo': [], 'criterios_preguntas': [{'numero_pregunta': 1}],
        'examenes_estudiantes': [{'estado_revision': 'pendiente', 'ruta_imagen_examen': 'examen'}]}
    repositorio = type('RepositorioPrueba', (), {'evaluacion': AsyncMock(return_value=evaluacion)})()
    tarifas = AsyncMock(return_value={'tarifa_entrada': '1', 'tarifa_salida': '2', 'fuente': 'tarifa de prueba'})
    monkeypatch.setattr(ServicioTarifasOficiales, 'obtener_tarifa', tarifas)
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).post(f'/api/evaluaciones/{identificador}/preparar', json={'proveedor': 'openai', 'modelo': 'gpt-4o'})
        assert respuesta.status_code == 200
        tarifas.assert_awaited_once_with('openai', 'gpt-4o')
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_preparacion_estima_solo_examenes_seleccionados(monkeypatch):
    from uuid import uuid4
    from unittest.mock import AsyncMock
    from presentacion.seguridad import obtener_repositorio
    from infraestructura.tarifas_ia import ServicioTarifasOficiales
    identificador, primero, segundo = str(uuid4()), str(uuid4()), str(uuid4())
    evaluacion = {'id': identificador, 'puntaje_total_maximo': 20, 'indicaciones_profesor': '',
        'soluciones_profesor': [{'ruta_almacenamiento': 'solucion', 'cantidad_paginas': 1}],
        'materiales_apoyo': [], 'criterios_preguntas': [{'numero_pregunta': 1}],
        'examenes_estudiantes': [{'id': primero, 'estado_revision': 'completado', 'ruta_imagen_examen': 'a'}, {'id': segundo, 'estado_revision': 'pendiente', 'ruta_imagen_examen': 'b'}]}
    repositorio = type('RepositorioPrueba', (), {'evaluacion': AsyncMock(return_value=evaluacion)})()
    monkeypatch.setattr(ServicioTarifasOficiales, 'obtener_tarifa', AsyncMock(return_value={'tarifa_entrada':'1', 'tarifa_salida':'2', 'fuente':'prueba'}))
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        cliente = TestClient(aplicacion)
        uno = cliente.post(f'/api/evaluaciones/{identificador}/preparar', json={'proveedor':'openai', 'modelo':'gpt-4o', 'examenes_ids':[primero]})
        ambos = cliente.post(f'/api/evaluaciones/{identificador}/preparar', json={'proveedor':'openai', 'modelo':'gpt-4o', 'examenes_ids':[primero, segundo]})
        ajeno = cliente.post(f'/api/evaluaciones/{identificador}/preparar', json={'proveedor':'openai', 'modelo':'gpt-4o', 'examenes_ids':[str(uuid4())]})
        assert uno.status_code == ambos.status_code == 200
        assert uno.json()['examenes'] == 1
        assert ambos.json()['examenes'] == 2
        assert float(ambos.json()['costo_usd']) == 2 * float(uno.json()['costo_usd'])
        assert ajeno.status_code == 422
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


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


def test_tarifa_desconocida_explica_que_no_hay_precio():
    respuesta = TestClient(aplicacion).get('/api/configuracion/tarifas-oficiales?proveedor=openai&modelo=modelo-desconocido')
    assert respuesta.status_code == 422
    assert 'tarifa disponible' in respuesta.json()['detalle']


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



def test_no_analiza_si_recepcion_de_alumnos_sigue_abierta_y_sin_cupo_completo(monkeypatch):
    from uuid import uuid4
    from unittest.mock import AsyncMock
    from presentacion.seguridad import obtener_repositorio
    identificador = str(uuid4())
    evaluacion = {'id': identificador, 'puntaje_total_maximo': 20, 'modalidad_recepcion': 'alumnos', 'recepcion_iniciada': True, 'recepcion_abierta': True, 'cantidad_estudiantes_esperados': 30, 'examenes_estudiantes': [], 'soluciones_profesor': [{'ruta_almacenamiento':'x'}], 'materiales_apoyo': []}
    repositorio = type('RepositorioPrueba', (), {'evaluacion': AsyncMock(return_value=evaluacion)})()
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).post(f'/api/evaluaciones/{identificador}/analizar-solucion', json={'proveedor':'openai','clave_api':'prueba','modelo':'ejemplo','confirmar_costo':True})
        assert respuesta.status_code == 409
        assert 'recepción' in respuesta.json()['detail'].lower()
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_analiza_solucion_solo_al_terminar_carga_manual(monkeypatch):
    from uuid import uuid4
    from unittest.mock import AsyncMock
    from presentacion.seguridad import obtener_repositorio
    from presentacion.evaluaciones import DocumentosPrivados, ProveedorHTTP
    identificador = str(uuid4())
    evaluacion = {'id': identificador, 'puntaje_total_maximo':20,'modalidad_recepcion':'manual','carga_manual_finalizada':False,'examenes_estudiantes':[{'id':'e'}], 'soluciones_profesor':[{'ruta_almacenamiento':'x'}], 'materiales_apoyo':[]}
    proveedor = AsyncMock(return_value={'preguntas':[{'numero_pregunta':1,'puntaje_maximo':20,'respuesta_esperada':'A'}]})
    monkeypatch.setattr(DocumentosPrivados, 'contexto', AsyncMock(return_value=[]))
    monkeypatch.setattr(ProveedorHTTP, 'generar', proveedor)
    repositorio = type('RepositorioPrueba', (), {'evaluacion': AsyncMock(return_value=evaluacion)})()
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        cliente=TestClient(aplicacion)
        datos={'proveedor':'openai','clave_api':'prueba','modelo':'ejemplo','confirmar_costo':True}
        assert cliente.post(f'/api/evaluaciones/{identificador}/analizar-solucion',json=datos).status_code == 409
        proveedor.assert_not_awaited()
        evaluacion['carga_manual_finalizada']=True
        assert cliente.post(f'/api/evaluaciones/{identificador}/analizar-solucion',json=datos).status_code == 200
        proveedor.assert_awaited_once()
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)
