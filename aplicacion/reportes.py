from dominio.calificacion import ExamenEstudiante
from dominio.puertos import IGeneradorExcel


class GenerarReporteExcelNotas:
    def __init__(self, generador: IGeneradorExcel):
        self.generador = generador

    def ejecutar(self, contexto: dict[str, str], examenes: tuple[ExamenEstudiante, ...]) -> bytes:
        return self.generador.generar(contexto, examenes)
