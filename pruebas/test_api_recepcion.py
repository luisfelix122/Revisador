from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from presentacion.api import aplicacion

cliente = TestClient(aplicacion)


def test_entrega_rechaza_si_no_existe_credencial_privada_del_servidor(monkeypatch):
    from io import BytesIO
    from PIL import Image

    monkeypatch.delenv('SUPABASE_CLAVE_SECRETA', raising=False)
    archivo = BytesIO()
    Image.new('RGB', (20, 20), 'white').save(archivo, format='PNG')
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico', new_callable=AsyncMock) as rpc, \
         patch('infraestructura.supabase.httpx.AsyncClient') as cliente_http:
        rpc.return_value = {'evaluacion_id': str(uuid4()), 'recepcion_abierta': True}
        respuesta = cliente.post(f'/api/recepcion/{uuid4()}/entregar', data={'nombre': 'Ana', 'codigo': '123'}, files={'archivo': ('examen.png', archivo.getvalue(), 'image/png')})
        assert respuesta.status_code == 503
        cliente_http.assert_not_called()


def test_entrega_traduce_el_rechazo_de_aforo_de_supabase(monkeypatch):
    from io import BytesIO
    from PIL import Image

    monkeypatch.setenv('SUPABASE_CLAVE_SECRETA', 'sb_secret_prueba')
    archivo = BytesIO()
    Image.new('RGB', (20, 20), 'white').save(archivo, format='PNG')
    respuesta_supabase = MagicMock(status_code=400)
    respuesta_supabase.json.return_value = {'code': '42301', 'message': 'Aforo completado'}
    conexion = AsyncMock()
    conexion.request.return_value = respuesta_supabase
    fabrica = MagicMock()
    fabrica.return_value.__aenter__ = AsyncMock(return_value=conexion)
    fabrica.return_value.__aexit__ = AsyncMock(return_value=False)
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico', new_callable=AsyncMock, return_value={'evaluacion_id': str(uuid4()), 'recepcion_abierta': True}), \
         patch('infraestructura.supabase.RepositorioSupabase.subir_archivo_publico', new_callable=AsyncMock, return_value='examen.jpg'), \
         patch('infraestructura.supabase.RepositorioSupabase.borrar_archivo_recepcion', new_callable=AsyncMock), \
         patch('infraestructura.supabase.httpx.AsyncClient', fabrica):
        respuesta = cliente.post(f'/api/recepcion/{uuid4()}/entregar', data={'nombre': 'Ana', 'codigo': '123'}, files={'archivo': ('examen.png', archivo.getvalue(), 'image/png')})
    assert respuesta.status_code == 423
    assert respuesta.json()['detail'] == 'Aforo completado'


def test_entrega_muestra_rechazo_de_reenvio_aunque_supabase_responda_500(monkeypatch):
    from io import BytesIO
    from PIL import Image

    monkeypatch.setenv('SUPABASE_CLAVE_SECRETA', 'sb_secret_prueba')
    archivo = BytesIO()
    Image.new('RGB', (20, 20), 'white').save(archivo, format='PNG')
    respuesta_supabase = MagicMock(status_code=500)
    respuesta_supabase.json.return_value = {'code': '40900', 'message': 'Ya has realizado una entrega.'}
    conexion = AsyncMock()
    conexion.request.return_value = respuesta_supabase
    fabrica = MagicMock()
    fabrica.return_value.__aenter__ = AsyncMock(return_value=conexion)
    fabrica.return_value.__aexit__ = AsyncMock(return_value=False)
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico', new_callable=AsyncMock, return_value={'evaluacion_id': str(uuid4()), 'recepcion_abierta': True}), \
         patch('infraestructura.supabase.RepositorioSupabase.subir_archivo_publico', new_callable=AsyncMock, return_value='examen.jpg'), \
         patch('infraestructura.supabase.RepositorioSupabase.borrar_archivo_recepcion', new_callable=AsyncMock), \
         patch('infraestructura.supabase.httpx.AsyncClient', fabrica):
        respuesta = cliente.post(f'/api/recepcion/{uuid4()}/entregar', data={'nombre': 'Ana', 'codigo': '123'}, files={'archivo': ('examen.png', archivo.getvalue(), 'image/png')})
    assert respuesta.status_code == 409
    assert respuesta.json()['detail'] == 'Ya has realizado una entrega.'


def test_entrega_no_borra_archivo_si_no_se_conoce_resultado_del_registro():
    from io import BytesIO
    from PIL import Image
    from infraestructura.supabase import ErrorPersistencia

    archivo = BytesIO()
    Image.new('RGB', (20, 20), 'white').save(archivo, format='PNG')
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico', new_callable=AsyncMock, return_value={'evaluacion_id': str(uuid4()), 'recepcion_abierta': True}), \
         patch('infraestructura.supabase.RepositorioSupabase.subir_archivo_publico', new_callable=AsyncMock, return_value='examen.jpg'), \
         patch('infraestructura.supabase.RepositorioSupabase.rpc_recepcion', new_callable=AsyncMock, side_effect=[{'reservado': True}, ErrorPersistencia('Conexión interrumpida', 503)]), \
         patch('infraestructura.supabase.RepositorioSupabase.borrar_archivo_recepcion', new_callable=AsyncMock) as borrar:
        respuesta = cliente.post(f'/api/recepcion/{uuid4()}/entregar', data={'nombre': 'Ana', 'codigo': '123'}, files={'archivo': ('examen.png', archivo.getvalue(), 'image/png')})
    assert respuesta.status_code == 503
    borrar.assert_not_awaited()


def test_entrega_conserva_pdf_completo():
    from io import BytesIO
    from PIL import Image

    archivo = BytesIO()
    Image.new('RGB', (20, 20), 'white').save(
        archivo, format='PDF', save_all=True,
        append_images=[Image.new('RGB', (20, 20), 'black')],
    )
    contenido = archivo.getvalue()
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico', new_callable=AsyncMock) as rpc, \
         patch('infraestructura.supabase.RepositorioSupabase.rpc_recepcion', new_callable=AsyncMock, return_value={'numero_entrega': 1}), \
         patch('infraestructura.supabase.RepositorioSupabase.subir_archivo_publico', new_callable=AsyncMock) as subir:
        rpc.return_value = {'evaluacion_id': str(uuid4()), 'recepcion_abierta': True}
        subir.return_value = 'estudiantes/examen.pdf'
        respuesta = cliente.post(f'/api/recepcion/{uuid4()}/entregar', data={'nombre': 'Ana', 'codigo': '123'}, files={'archivo': ('examen.pdf', contenido, 'application/pdf')})
        assert respuesta.status_code == 200
        assert subir.call_args.args[1] == contenido
        assert subir.call_args.args[0].endswith('.pdf')
        assert subir.call_args.kwargs['tipo_mime'] == 'application/pdf'


def test_entrega_aplica_rotacion_a_la_imagen():
    from io import BytesIO
    from PIL import Image

    archivo = BytesIO()
    Image.new('RGB', (40, 20), 'white').save(archivo, format='PNG')
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico', new_callable=AsyncMock) as rpc, \
         patch('infraestructura.supabase.RepositorioSupabase.rpc_recepcion', new_callable=AsyncMock, return_value={'numero_entrega': 1}), \
         patch('infraestructura.supabase.RepositorioSupabase.subir_archivo_publico', new_callable=AsyncMock) as subir:
        rpc.return_value = {'evaluacion_id': str(uuid4()), 'recepcion_abierta': True}
        subir.return_value = 'estudiantes/examen.jpg'
        respuesta = cliente.post(f'/api/recepcion/{uuid4()}/entregar', data={'nombre': 'Ana', 'codigo': '123', 'rotacion': '90'}, files={'archivo': ('examen.png', archivo.getvalue(), 'image/png')})
        assert respuesta.status_code == 200
        assert Image.open(BytesIO(subir.call_args.args[1])).size == (20, 40)


def test_obtener_info_recepcion_publica():
    token = str(uuid4())
    datos_mock = {
        "evaluacion_id": str(uuid4()),
        "titulo": "Práctica Calificada 01",
        "curso": "Algoritmos y Estructuras de Datos",
        "facultad": "Ingeniería de Sistemas",
        "escuela": "Ingeniería de Software",
        "anio": 2026,
        "puntaje_maximo": 20.0,
        "recepcion_abierta": True,
        "fecha_cierre": None,
        "permitir_reenvios_global": False,
    }

    with patch("infraestructura.supabase.RepositorioSupabase.rpc_publico", new_callable=AsyncMock) as mock_rpc:
        mock_rpc.return_value = datos_mock
        respuesta = cliente.get(f"/api/recepcion/{token}")
        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["titulo"] == "Práctica Calificada 01"
        assert cuerpo["recepcion_abierta"] is True
        assert cuerpo["curso"] == "Algoritmos y Estructuras de Datos"


def test_entregar_examen_publico_exitoso():
    token = str(uuid4())
    datos_eval_mock = {
        "evaluacion_id": str(uuid4()),
        "titulo": "PC01",
        "recepcion_abierta": True,
        "fecha_cierre": None,
        "permitir_reenvios_global": False,
    }
    datos_registro_mock = {
        "examen_id": str(uuid4()),
        "numero_entrega": 1,
        "codigo_estudiante": "20260001",
        "nombre_estudiante": "Carlos Ramos",
    }

    from io import BytesIO
    from PIL import Image

    img_bytes = BytesIO()
    Image.new("RGB", (100, 100), color="white").save(img_bytes, format="PNG")
    img_bytes.seek(0)

    with patch("infraestructura.supabase.RepositorioSupabase.solicitar_publico", new_callable=AsyncMock) as mock_sol, \
         patch("infraestructura.supabase.RepositorioSupabase.rpc_publico", new_callable=AsyncMock) as mock_rpc, \
         patch("infraestructura.supabase.RepositorioSupabase.rpc_recepcion", new_callable=AsyncMock) as mock_registro, \
         patch("infraestructura.supabase.RepositorioSupabase.subir_archivo_publico", new_callable=AsyncMock) as mock_up:
        
        mock_rpc.return_value = datos_eval_mock
        mock_registro.return_value = datos_registro_mock
        mock_up.return_value = "public/eval/examen_1.jpg"

        archivos = {"archivo": ("examen.png", img_bytes.getvalue(), "image/png")}
        datos = {"nombre": "Carlos Ramos", "codigo": "20260001"}

        respuesta = cliente.post(f"/api/recepcion/{token}/entregar", data=datos, files=archivos)
        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["codigo_estudiante"] == "20260001"
        assert cuerpo["numero_entrega"] == 1


def test_entregar_examen_rechazado_si_recepcion_cerrada():
    token = str(uuid4())
    datos_eval_mock = {
        "evaluacion_id": str(uuid4()),
        "titulo": "PC01",
        "recepcion_abierta": False,
        "fecha_cierre": None,
        "permitir_reenvios_global": False,
    }

    with patch("infraestructura.supabase.RepositorioSupabase.rpc_publico", new_callable=AsyncMock) as mock_rpc:
        mock_rpc.return_value = datos_eval_mock
        archivos = {"archivo": ("examen.png", b"fake", "image/png")}
        datos = {"nombre": "Carlos Ramos", "codigo": "20260001"}

        respuesta = cliente.post(f"/api/recepcion/{token}/entregar", data=datos, files=archivos)
        assert respuesta.status_code in (403, 422, 423)


def test_entregar_examen_rechazado_si_cupo_superado():
    token = str(uuid4())
    datos_eval_mock = {
        "evaluacion_id": str(uuid4()),
        "titulo": "PC01",
        "recepcion_abierta": True,
        "fecha_cierre": None,
        "permitir_reenvios_global": False,
        "cantidad_estudiantes_esperados": 30,
        "total_entregados": 30,
        "cupo_alcanzado": True,
    }

    from infraestructura.supabase import ErrorPersistencia
    from io import BytesIO
    from PIL import Image

    img_bytes = BytesIO()
    Image.new("RGB", (100, 100), color="white").save(img_bytes, format="PNG")

    with patch("infraestructura.supabase.RepositorioSupabase.rpc_publico", new_callable=AsyncMock) as mock_rpc, \
         patch("infraestructura.supabase.RepositorioSupabase.rpc_recepcion", new_callable=AsyncMock) as mock_registro, \
         patch("infraestructura.supabase.RepositorioSupabase.borrar_archivo_recepcion", new_callable=AsyncMock) as mock_borrar, \
         patch("infraestructura.supabase.RepositorioSupabase.subir_archivo_publico", new_callable=AsyncMock) as mock_up:
        
        mock_rpc.return_value = datos_eval_mock
        mock_registro.side_effect = [{'reservado': True}, ErrorPersistencia("Se ha alcanzado el límite de estudiantes esperados (30 alumnos) para este examen. Si estás en el aula, consulta con tu docente.", 423)]
        mock_up.return_value = "public/eval/examen_31.jpg"

        archivos = {"archivo": ("examen.png", img_bytes.getvalue(), "image/png")}
        datos = {"nombre": "Alumno Extra", "codigo": "20260031"}

        respuesta = cliente.post(f"/api/recepcion/{token}/entregar", data=datos, files=archivos)
        assert respuesta.status_code == 423
        assert "límite de estudiantes esperados" in respuesta.json()["detail"]
        mock_borrar.assert_awaited_once_with("public/eval/examen_31.jpg")



def test_alumno_envia_varias_fotos_como_un_solo_examen_pdf():
    from io import BytesIO
    from PIL import Image
    from pypdf import PdfReader
    fotos=[]
    for nombre,color in [('pagina1.png','white'),('pagina2.png','blue')]:
        imagen=BytesIO(); Image.new('RGB',(40,30),color).save(imagen,format='PNG')
        fotos.append(('archivos',(nombre,imagen.getvalue(),'image/png')))
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_publico',new_callable=AsyncMock,return_value={'evaluacion_id':str(uuid4()),'recepcion_abierta':True}), \
         patch('infraestructura.supabase.RepositorioSupabase.rpc_recepcion',new_callable=AsyncMock,return_value={'numero_entrega':1}) as registrar, \
         patch('infraestructura.supabase.RepositorioSupabase.subir_archivo_publico',new_callable=AsyncMock,return_value='estudiantes/examen.pdf') as subir:
        respuesta=cliente.post(f'/api/recepcion/{uuid4()}/entregar-fotos',data={'nombre':'Ana','codigo':'123','rotaciones':'[0,90]'},files=fotos)
        assert respuesta.status_code==200
        assert len(PdfReader(BytesIO(subir.call_args.args[1])).pages)==2
        assert [llamada.args[0] for llamada in registrar.await_args_list] == ['reservar_archivo_entrega', 'registrar_entrega_estudiante']


def test_limpieza_requiere_secreto_y_confirma_despues_de_borrar(monkeypatch):
    monkeypatch.setenv('CRON_SECRET', 'secreto-de-prueba')
    with patch('infraestructura.supabase.RepositorioSupabase.rpc_recepcion', new_callable=AsyncMock, side_effect=[['estudiantes/e/archivo.jpg'], None]) as rpc, \
         patch('infraestructura.supabase.RepositorioSupabase.borrar_archivos_recepcion', new_callable=AsyncMock) as borrar:
        assert cliente.get('/api/recepcion/tareas/limpiar-archivos').status_code == 401
        respuesta = cliente.get('/api/recepcion/tareas/limpiar-archivos', headers={'Authorization': 'Bearer secreto-de-prueba'})
        assert respuesta.json() == {'archivos_limpiados': 1}
        borrar.assert_awaited_once_with(['estudiantes/e/archivo.jpg'])
        assert [llamada.args[0] for llamada in rpc.await_args_list] == ['reclamar_limpieza_entregas', 'confirmar_limpieza_entregas']
