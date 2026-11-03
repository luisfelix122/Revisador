from decimal import Decimal
from io import BytesIO

from openpyxl import load_workbook
import pytest

from dominio.calificacion import DetallePregunta, ExamenEstudiante
from infraestructura.excel import GeneradorExcel


def test_debe_exportar_acta_con_puntajes_y_formulas_nativas():
    examen = ExamenEstudiante("=HYPERLINK(\"https://ejemplo.com\")", "01", (DetallePregunta(1, Decimal("4"), Decimal("4"), "Respuesta", "Correcta"),), "Buen trabajo")
    contenido = GeneradorExcel().generar({"curso": "Álgebra", "evaluacion": "Parcial"}, (examen,))
    hoja = load_workbook(BytesIO(contenido))["Acta_de_Notas"]
    assert hoja["D7"].value == "P1 (4 pts)"
    assert hoja["E8"].value == 4
    assert hoja["C8"].data_type == "s"
    assert hoja["E10"].value == "=AVERAGE(E8:E8)"


def test_debe_rechazar_rubricas_con_maximos_distintos_para_la_misma_pregunta():
    examenes = tuple(ExamenEstudiante("Ana", "01", (DetallePregunta(1, Decimal("1"), Decimal(maximo), "Respuesta", "Parcial"),), "") for maximo in ("4", "5"))
    with pytest.raises(ValueError, match="rúbrica"):
        GeneradorExcel().generar({}, examenes)
