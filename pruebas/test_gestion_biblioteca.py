from uuid import uuid4
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from presentacion.api import aplicacion
from presentacion.seguridad import obtener_repositorio


def test_renombrar_curso_conserva_ubicacion():
    identificador = str(uuid4())
    repositorio = type('RepositorioPrueba', (), {'solicitar': AsyncMock(return_value=[{'id': identificador, 'nombre': 'Física'}])})()
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).patch(f'/api/biblioteca/cursos/{identificador}', json={'nombre': ' Física '})
        assert respuesta.status_code == 200
        assert respuesta.json()['nombre'] == 'Física'
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_renombrar_evaluacion_desde_api():
    identificador = str(uuid4())
    repositorio = type('RepositorioPrueba', (), {'rpc': AsyncMock(return_value={'titulo': 'Práctica 2'})})()
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).patch(f'/api/evaluaciones/{identificador}', json={'nombre': 'Práctica 2'})
        assert respuesta.status_code == 200
        assert respuesta.json()['titulo'] == 'Práctica 2'
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_eliminar_evaluacion_limpia_archivos_incluyendo_historial_antes_de_finalizar():
    from types import SimpleNamespace
    identificador, propietario = str(uuid4()), str(uuid4())
    rutas = ['solucion.pdf', 'entrega-1.jpg', 'entrega-2.jpg']
    repositorio = SimpleNamespace(sesion=SimpleNamespace(usuario_id=propietario), clave_recepcion=lambda: 'configurada',
        rpc=AsyncMock(return_value={'iniciado': True, 'rutas': rutas}), borrar_archivos_recepcion=AsyncMock(),
        rpc_recepcion=AsyncMock(return_value={'eliminado': True}))
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).delete(f'/api/evaluaciones/{identificador}')
        assert respuesta.status_code == 200
        assert respuesta.json()['eliminado']
        repositorio.borrar_archivos_recepcion.assert_awaited_once_with(rutas)
        repositorio.rpc_recepcion.assert_awaited_once_with('finalizar_eliminacion_evaluacion', {'p_evaluacion': identificador, 'p_propietario': propietario})
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)


def test_fallo_de_storage_no_elimina_los_datos_de_la_evaluacion():
    from types import SimpleNamespace
    from infraestructura.supabase import ErrorPersistencia
    repositorio = SimpleNamespace(sesion=SimpleNamespace(usuario_id=uuid4()), clave_recepcion=lambda: 'configurada',
        rpc=AsyncMock(return_value={'iniciado': True, 'rutas': ['examen.jpg']}),
        borrar_archivos_recepcion=AsyncMock(side_effect=ErrorPersistencia('Storage no disponible')), rpc_recepcion=AsyncMock())
    aplicacion.dependency_overrides[obtener_repositorio] = lambda: repositorio
    try:
        respuesta = TestClient(aplicacion).delete(f'/api/evaluaciones/{uuid4()}')
        assert respuesta.status_code == 503
        repositorio.rpc_recepcion.assert_not_awaited()
    finally:
        aplicacion.dependency_overrides.pop(obtener_repositorio, None)
