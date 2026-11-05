from datetime import datetime, timezone, timedelta
from uuid import uuid4
import pytest
from dominio.recepcion import (
    ControlRecepcionEvaluacion,
    EntregaEstudiante,
    ErrorEntregaCerrada,
    ErrorEntregaDuplicada,
    ErrorCupoAlumnosSuperado,
    filtrar_examenes_a_calificar
)


def test_recepcion_abierta_sin_limite_de_tiempo():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=None,
        fecha_cierre_programada=None,
        permitir_reenvios_global=False
    )
    assert control.esta_activa(datetime.now(timezone.utc)) is True


def test_recepcion_cerrada_manualmente():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=False,
        tiempo_limite_minutos=30,
        fecha_cierre_programada=datetime.now(timezone.utc) + timedelta(minutes=30),
        permitir_reenvios_global=False
    )
    assert control.esta_activa(datetime.now(timezone.utc)) is False


def test_recepcion_cerrada_por_tiempo_vencido():
    ahora = datetime.now(timezone.utc)
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=15,
        fecha_cierre_programada=ahora - timedelta(seconds=1),
        permitir_reenvios_global=False
    )
    assert control.esta_activa(ahora) is False


def test_entrega_codigo_obligatorio():
    with pytest.raises(ValueError, match="El código de estudiante es obligatorio"):
        EntregaEstudiante(
            codigo_estudiante="   ",
            nombre_estudiante="Carlos Ramos",
            ruta_archivo="archivo.png"
        )


def test_bloqueo_duplicados_sin_permiso():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=None,
        fecha_cierre_programada=None,
        permitir_reenvios_global=False
    )
    ahora = datetime.now(timezone.utc)
    # Alumno que ya entregó (entrega_previa existe y permitir_reenvio es False)
    with pytest.raises(ErrorEntregaDuplicada):
        control.validar_nueva_entrega(
            codigo_estudiante="20220011",
            ya_entregado=True,
            permitir_reenvio_individual=False,
            ahora=ahora
        )


def test_reenvio_permitido_individualmente():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=None,
        fecha_cierre_programada=None,
        permitir_reenvios_global=False
    )
    ahora = datetime.now(timezone.utc)
    # Alumno que ya entregó pero el docente le dio permiso individual
    nuevo_numero = control.validar_nueva_entrega(
        codigo_estudiante="20220011",
        ya_entregado=True,
        permitir_reenvio_individual=True,
        entregas_anteriores=1,
        ahora=ahora
    )
    assert nuevo_numero == 2


def test_reenvio_permitido_globalmente():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=None,
        fecha_cierre_programada=None,
        permitir_reenvios_global=True
    )
    ahora = datetime.now(timezone.utc)
    nuevo_numero = control.validar_nueva_entrega(
        codigo_estudiante="20220022",
        ya_entregado=True,
        permitir_reenvio_individual=False,
        entregas_anteriores=2,
        ahora=ahora
    )
    assert nuevo_numero == 3


def test_filtrar_examenes_para_calificar():
    examenes = [
        {"id": "e1", "estado_revision": "pendiente"},
        {"id": "e2", "estado_revision": "completado"},
        {"id": "e3", "estado_revision": "pendiente"},
    ]
    # Modo solo pendientes
    pendientes = filtrar_examenes_a_calificar(examenes, modo="pendientes")
    assert [e["id"] for e in pendientes] == ["e1", "e3"]

    # Modo todos
    todos = filtrar_examenes_a_calificar(examenes, modo="todos")
    assert [e["id"] for e in todos] == ["e1", "e2", "e3"]

    # Modo seleccionados
    seleccionados = filtrar_examenes_a_calificar(examenes, modo="seleccionados", seleccionados=["e2", "e3"])
    assert [e["id"] for e in seleccionados] == ["e2", "e3"]


def test_bloqueo_aforo_alumnos_superado():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=None,
        fecha_cierre_programada=None,
        permitir_reenvios_global=False,
        cantidad_estudiantes_esperados=30
    )
    ahora = datetime.now(timezone.utc)
    # Si hay 30 estudiantes ya registrados e intenta entrar un alumno nuevo (alumno #31)
    with pytest.raises(ErrorCupoAlumnosSuperado, match="límite de estudiantes esperados"):
        control.validar_nueva_entrega(
            codigo_estudiante="20269999",
            ya_entregado=False,
            total_estudiantes_actuales=30,
            ahora=ahora
        )

    # Si hay 29 registrados y entra el alumno #30, debe permitirlo
    assert control.validar_nueva_entrega(
        codigo_estudiante="20269999",
        ya_entregado=False,
        total_estudiantes_actuales=29,
        ahora=ahora
    ) == 1


def test_alumno_existente_reenvio_no_bloqueado_por_aforo():
    control = ControlRecepcionEvaluacion(
        token_recepcion=uuid4(),
        recepcion_abierta=True,
        tiempo_limite_minutos=None,
        fecha_cierre_programada=None,
        permitir_reenvios_global=True,
        cantidad_estudiantes_esperados=30
    )
    ahora = datetime.now(timezone.utc)
    # Un alumno que ya forma parte de los 30 en aula puede reenviar si tiene permiso
    assert control.validar_nueva_entrega(
        codigo_estudiante="20260001",
        ya_entregado=True,
        total_estudiantes_actuales=30,
        entregas_anteriores=1,
        ahora=ahora
    ) == 2

