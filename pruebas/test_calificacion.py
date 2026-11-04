from decimal import Decimal
import pytest

from dominio.calificacion import DetallePregunta, ExamenEstudiante


def test_debe_asignar_nada_y_cero_a_respuesta_omitida():
    pregunta = DetallePregunta(1, Decimal("3"), Decimal("4"), "  ", "Sin respuesta")
    examen = ExamenEstudiante("  ", "", (pregunta,), "Revisar identificación")
    assert examen.nombre_estudiante == "nada"
    assert examen.codigo_estudiante == "nada"
    assert pregunta.respuesta_detectada == "nada"
    assert pregunta.puntaje_obtenido == Decimal("0")
    assert examen.nota_final == Decimal("0")


def test_debe_sumar_exactamente_los_puntajes_sin_error_binario():
    preguntas = tuple(DetallePregunta(numero, Decimal("0.1"), Decimal("1"), "Sí", "Correcto") for numero in (1, 2, 3))
    assert ExamenEstudiante("Ana", "01", preguntas, "Bien").nota_final == Decimal("0.3")


@pytest.mark.parametrize("obtenido,maximo", [("-1", "4"), ("5", "4"), ("0", "-1"), ("NaN", "4"), ("Infinity", "4")])
def test_debe_rechazar_puntajes_fuera_de_rango(obtenido, maximo):
    with pytest.raises(ValueError):
        DetallePregunta(1, Decimal(obtenido), Decimal(maximo), "Respuesta", "Justificación")


def test_debe_rechazar_preguntas_duplicadas_en_un_examen():
    pregunta = DetallePregunta(1, Decimal("1"), Decimal("4"), "Respuesta", "Parcial")
    with pytest.raises(ValueError):
        ExamenEstudiante("Ana", "01", (pregunta, pregunta), "")

def test_puntajes_con_mas_de_dos_decimales_no_deben_redondearse_silenciosamente():
    with pytest.raises(ValueError):
        DetallePregunta(1,Decimal('0.001'),Decimal('4'),'Respuesta','Parcial')
def test_respuesta_nada_con_espacios_o_mayusculas_no_obtiene_puntos():
    pregunta = DetallePregunta(1, Decimal('4'), Decimal('5'), ' Nada ', 'Sin respuesta')
    assert pregunta.respuesta_detectada == 'nada'
    assert pregunta.puntaje_obtenido == Decimal('0')
