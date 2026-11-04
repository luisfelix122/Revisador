import asyncio
from decimal import Decimal
import pytest
from aplicacion.motor import validar_resultado


def test_motor_rechaza_preguntas_omitidas_y_maximos_inventados():
    rubrica = [{'numero_pregunta': 1, 'puntaje_maximo': 4}]
    with pytest.raises(ValueError):
        validar_resultado({'nombre_estudiante':'Ana','codigo_estudiante':'01','observaciones_generales':'','preguntas':[]}, rubrica)
    with pytest.raises(ValueError):
        validar_resultado({'nombre_estudiante':'Ana','codigo_estudiante':'01','observaciones_generales':'','preguntas':[{'numero_pregunta':1,'puntaje_maximo':9,'puntaje_obtenido':9,'respuesta_detectada':'A','justificacion':'Correcto'}]}, rubrica)

def test_proveedor_devuelve_json_estructurado_sin_guardar_respuesta(monkeypatch):
    import httpx
    from infraestructura.proveedores import ProveedorHTTP
    async def responder(cliente, metodo, url, **opciones):
        assert opciones['json']['store'] is False
        assert opciones['json']['text']['format']['type']=='json_schema'
        return httpx.Response(200,json={'output':[{'content':[{'type':'output_text','text':'{"preguntas":[]}'}]}]})
    monkeypatch.setattr(httpx.AsyncClient,'request',responder)
    resultado=asyncio.run(ProveedorHTTP('openai').generar('clave-prueba','modelo-prueba','Extrae criterios',[],{'type':'object','properties':{},'additionalProperties':False}))
    assert resultado == {'preguntas':[]}


@pytest.mark.parametrize('proveedor', ['openai', 'gemini'])
def test_proveedor_mantiene_asociados_texto_e_imagenes_de_cada_documento(monkeypatch, proveedor):
    import httpx
    from infraestructura.archivos import DocumentoExtraido
    from infraestructura.proveedores import ProveedorHTTP
    documentos = [DocumentoExtraido('pdf',1,'Texto solución',('imagen-solucion',)),
                  DocumentoExtraido('pdf',1,'Texto apoyo',('imagen-apoyo',)),
                  DocumentoExtraido('imagen',1,'',('imagen-examen',))]
    async def responder(cliente, metodo, url, **opciones):
        cuerpo = opciones['json']
        partes = cuerpo['input'][0]['content'] if proveedor == 'openai' else cuerpo['contents'][0]['parts']
        orden = [p.get('text', p.get('image_url', p.get('inline_data', {}).get('data', ''))) for p in partes]
        solucion = next(i for i, valor in enumerate(orden) if 'Texto solución' in valor)
        imagen_solucion = next(i for i, valor in enumerate(orden) if 'imagen-solucion' in valor)
        apoyo = next(i for i, valor in enumerate(orden) if 'Texto apoyo' in valor)
        imagen_apoyo = next(i for i, valor in enumerate(orden) if 'imagen-apoyo' in valor)
        imagen_examen = next(i for i, valor in enumerate(orden) if 'imagen-examen' in valor)
        assert solucion < imagen_solucion < apoyo < imagen_apoyo < imagen_examen
        respuesta = {'output':[{'content':[{'type':'output_text','text':'{}'}]}]} if proveedor == 'openai' else {'candidates':[{'content':{'parts':[{'text':'{}'}]}}]}
        return httpx.Response(200,json=respuesta)
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    assert asyncio.run(ProveedorHTTP(proveedor).generar('clave-prueba','modelo-prueba','Instrucciones',documentos,{'type':'object'})) == {}


@pytest.mark.parametrize('proveedor', ['openai', 'gemini'])
def test_no_reenvia_automaticamente_una_generacion_tras_tiempo_de_espera(monkeypatch, proveedor):
    import httpx
    from dominio.puertos import ErrorProveedor
    from infraestructura.proveedores import ProveedorHTTP
    llamadas = []
    async def responder(cliente, metodo, url, **opciones):
        llamadas.append(url)
        raise httpx.ReadTimeout('tiempo agotado')
    async def esperar(_): pass
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    monkeypatch.setattr(asyncio, 'sleep', esperar)
    with pytest.raises(ErrorProveedor, match='saldo'):
        asyncio.run(ProveedorHTTP(proveedor).generar('clave','modelo','Instrucciones',[],{'type':'object'}))
    assert len(llamadas) == 1


@pytest.mark.parametrize('proveedor', ['openai', 'gemini'])
@pytest.mark.parametrize('datos', [['contenido que no es objeto'], {'data': None, 'models': None}, {'data': [None], 'models': [None]}])
def test_lista_de_modelos_rechaza_json_con_formato_invalido(monkeypatch, proveedor, datos):
    import httpx
    from dominio.puertos import ErrorProveedor
    from infraestructura.proveedores import ProveedorHTTP
    async def responder(cliente, metodo, url, **opciones):
        return httpx.Response(200, json=datos)
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    with pytest.raises(ErrorProveedor, match='respuesta no válida'):
        asyncio.run(ProveedorHTTP(proveedor).listar_modelos('clave-prueba'))


@pytest.mark.parametrize('proveedor', ['openai', 'gemini'])
def test_comprobacion_no_marca_conexion_si_no_hay_respuesta_de_modelo(monkeypatch, proveedor):
    import httpx
    from dominio.puertos import ErrorProveedor
    from infraestructura.proveedores import ProveedorHTTP
    async def responder(cliente, metodo, url, **opciones):
        return httpx.Response(200, json={})
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    with pytest.raises(ErrorProveedor, match='respuesta'):
        asyncio.run(ProveedorHTTP(proveedor).comprobar('clave-prueba', 'modelo-prueba'))


@pytest.mark.parametrize('proveedor', ['openai', 'gemini'])
def test_comprobacion_acepta_respuesta_de_modelo(monkeypatch, proveedor):
    import httpx
    from infraestructura.proveedores import ProveedorHTTP
    async def responder(cliente, metodo, url, **opciones):
        respuesta = {'output':[{'content':[{'type':'output_text','text':'OK'}]}]} if proveedor == 'openai' else {'candidates':[{'content':{'parts':[{'text':'OK'}]}}]}
        return httpx.Response(200, json=respuesta)
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    assert asyncio.run(ProveedorHTTP(proveedor).comprobar('clave-prueba', 'modelo-prueba')) is None
