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
