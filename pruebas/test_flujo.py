from fastapi.testclient import TestClient
from presentacion.api import aplicacion


def test_biblioteca_debe_exigir_sesion_valida():
    respuesta = TestClient(aplicacion).get('/api/biblioteca')
    assert respuesta.status_code == 401

import httpx
from uuid import UUID


def test_biblioteca_verifica_token_y_consulta_con_identidad_del_profesor(monkeypatch):
    llamadas = []
    async def responder(cliente, metodo, url, **opciones):
        llamadas.append((url, opciones['headers']))
        if url.endswith('/auth/v1/user'):
            return httpx.Response(200, json={'id':'11111111-1111-4111-8111-111111111111'})
        return httpx.Response(200, json=[])
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    respuesta = TestClient(aplicacion).get('/api/biblioteca', headers={'Authorization':'Bearer sesion-prueba'})
    assert respuesta.status_code == 200
    assert respuesta.json() == []
    assert llamadas[1][1]['Authorization'] == 'Bearer sesion-prueba'


def test_crea_anio_solo_con_datos_normalizados(monkeypatch):
    async def responder(cliente, metodo, url, **opciones):
        if url.endswith('/auth/v1/user'):
            return httpx.Response(200, json={'id':'11111111-1111-4111-8111-111111111111'})
        assert opciones['json'] == {'anio':2026}
        return httpx.Response(201, json=[{'id':'22222222-2222-4222-8222-222222222222','anio':2026}])
    monkeypatch.setattr(httpx.AsyncClient, 'request', responder)
    respuesta = TestClient(aplicacion).post('/api/biblioteca/anios_academicos', headers={'Authorization':'Bearer sesion-prueba'}, json={'nombre':'2026'})
    assert respuesta.status_code == 200
    assert respuesta.json()['anio'] == 2026

def test_archivos_y_calificacion_exigen_autenticacion():
    cliente=TestClient(aplicacion)
    for ruta in ['/api/evaluaciones/11111111-1111-4111-8111-111111111111/archivos/solucion','/api/evaluaciones/11111111-1111-4111-8111-111111111111/estimar','/api/evaluaciones/11111111-1111-4111-8111-111111111111/calificar/22222222-2222-4222-8222-222222222222']:
        assert cliente.post(ruta,json={}).status_code == 401

def test_flujo_http_califica_persiste_y_exporta_sin_llamada_pagada(monkeypatch):
    import io
    from PIL import Image
    from openpyxl import load_workbook
    identificador='f1111111-1111-4111-8111-111111111111'
    examen_id='e1111111-1111-4111-8111-111111111111'
    propietario='11111111-1111-4111-8111-111111111111'
    ruta=propietario+'/'+identificador+'/foto.png'
    pregunta={'numero_pregunta':1,'puntaje_maximo':20,'puntaje_obtenido':15,'respuesta_detectada':'Respuesta parcial','justificacion':'Procedimiento correcto con error final'}
    salida={'nombre_estudiante':'Ana','codigo_estudiante':'01','observaciones_generales':'Revisar cálculo','preguntas':[pregunta]}
    evaluacion={'id':identificador,'titulo':'Parcial','puntaje_total_maximo':20,'indicaciones_profesor':'Puntaje parcial','criterios_preguntas':[{'numero_pregunta':1,'puntaje_maximo':20,'respuesta_esperada':'Respuesta completa'}],'soluciones_profesor':[{'ruta_almacenamiento':ruta,'cantidad_paginas':1}],'materiales_apoyo':[],'examenes_estudiantes':[{'id':examen_id,'ruta_imagen_examen':ruta,'estado_revision':'pendiente','detalles_preguntas':[]}],'cursos':{'nombre':'Álgebra','promociones_ciclos':{'denominacion':'I','escuelas':{'nombre':'Sistemas','facultades':{'nombre':'Ingeniería','anios_academicos':{'anio':2026}}}}}}
    memoria=io.BytesIO();Image.new('RGB',(8,8),'white').save(memoria,format='PNG')
    async def responder(cliente,metodo,url,**opciones):
        if url.endswith('/auth/v1/user'):return httpx.Response(200,json={'id':propietario})
        if '/rest/v1/evaluaciones?' in url:return httpx.Response(200,json=[evaluacion])
        if '/storage/v1/object/authenticated/' in url:return httpx.Response(200,content=memoria.getvalue())
        if url.endswith('/rpc/iniciar_examen'):return httpx.Response(200,json={'completado':False,'intento':'11111111-1111-4111-8111-111111111111'})
        if url.endswith('/responses'):return httpx.Response(200,json={'output':[{'content':[{'type':'output_text','text':__import__('json').dumps(salida)}]}]})
        if url.endswith('/rpc/guardar_resultado'):
            if opciones['json']['p_revisado']:
                assert float(opciones['json']['p_resultado']['preguntas'][0]['puntaje_obtenido']) == 0
                return httpx.Response(200,json={'guardado':True,'nota_final':0})
            assert opciones['json']['p_resultado']['preguntas'][0]['puntaje_obtenido']=='15.0'
            evaluacion['examenes_estudiantes'][0].update({**salida,'nota_final':15,'estado_revision':'completado','detalles_preguntas':[{**pregunta,'id':'detalle'}]})
            return httpx.Response(200,json={'guardado':True,'nota_final':15})
        raise AssertionError(url)
    monkeypatch.setattr(httpx.AsyncClient,'request',responder)
    cliente=TestClient(aplicacion);cabeceras={'Authorization':'Bearer token-prueba'}
    estimacion=cliente.post('/api/evaluaciones/'+identificador+'/estimar',headers=cabeceras,json={'modelo':'modelo-prueba','tarifa_entrada':1,'tarifa_salida':2})
    assert estimacion.status_code==200
    # El orden de las relaciones devueltas por la base no cambia el contenido.
    evaluacion['materiales_apoyo'] = [{'ruta_almacenamiento':propietario+'/material-a.png','cantidad_paginas':1}, {'ruta_almacenamiento':propietario+'/material-b.png','cantidad_paginas':1}]
    estimacion=cliente.post('/api/evaluaciones/'+identificador+'/estimar',headers=cabeceras,json={'modelo':'modelo-prueba','tarifa_entrada':1,'tarifa_salida':2})
    evaluacion['materiales_apoyo'].reverse()
    respuesta=cliente.post('/api/evaluaciones/'+identificador+'/calificar/'+examen_id,headers=cabeceras,json={'proveedor':'openai','modelo':'modelo-prueba','clave_api':'clave-prueba','confirmar_costo':True,'huella':estimacion.json()['huella']})
    assert respuesta.status_code==200
    assert respuesta.json()['nota_final']==15
    revision={**salida,'preguntas':[{**pregunta,'respuesta_detectada':'nada'}]}
    respuesta_revision=cliente.put('/api/evaluaciones/'+identificador+'/revision/'+examen_id,headers=cabeceras,json=revision)
    assert respuesta_revision.status_code == 200
    reporte=cliente.get('/api/evaluaciones/'+identificador+'/reporte',headers=cabeceras)
    assert reporte.status_code==200
    hoja=load_workbook(io.BytesIO(reporte.content))['Acta_de_Notas']
    assert hoja['C8'].value=='Ana'
    assert hoja['E8'].value==15
