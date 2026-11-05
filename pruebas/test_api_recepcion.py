from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from presentacion.api import aplicacion

cliente = TestClient(aplicacion)


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
         patch("infraestructura.supabase.RepositorioSupabase.subir_archivo_publico", new_callable=AsyncMock) as mock_up:
        
        mock_rpc.side_effect = [datos_eval_mock, datos_registro_mock]
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
         patch("infraestructura.supabase.RepositorioSupabase.subir_archivo_publico", new_callable=AsyncMock) as mock_up:
        
        mock_rpc.side_effect = [
            datos_eval_mock,
            ErrorPersistencia("Se ha alcanzado el límite de estudiantes esperados (30 alumnos) para este examen. Si estás en el aula, consulta con tu docente.", 423)
        ]
        mock_up.return_value = "public/eval/examen_31.jpg"

        archivos = {"archivo": ("examen.png", img_bytes.getvalue(), "image/png")}
        datos = {"nombre": "Alumno Extra", "codigo": "20260031"}

        respuesta = cliente.post(f"/api/recepcion/{token}/entregar", data=datos, files=archivos)
        assert respuesta.status_code == 423
        assert "límite de estudiantes esperados" in respuesta.json()["detail"]

