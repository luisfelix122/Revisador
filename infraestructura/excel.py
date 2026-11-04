from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from dominio.calificacion import ExamenEstudiante


class GeneradorExcel:
    def generar(self, contexto: dict[str, str], examenes: tuple[ExamenEstudiante, ...], revisiones: tuple[bool, ...] | None = None) -> bytes:
        if revisiones is not None and len(revisiones) != len(examenes):
            raise ValueError('Cada examen debe tener un estado de revisión')
        libro = Workbook()
        hoja = libro.active
        hoja.title = "Acta_de_Notas"
        preguntas = {pregunta.numero_pregunta: pregunta.puntaje_maximo for examen in examenes for pregunta in examen.preguntas}
        if any(pregunta.puntaje_maximo != preguntas[pregunta.numero_pregunta] for examen in examenes for pregunta in examen.preguntas):
            raise ValueError("Los exámenes deben compartir la misma rúbrica")
        numeros = sorted(preguntas)
        encabezados = ["N°", "Código", "Nombre del Estudiante"] + [f"P{numero} ({preguntas[numero]} pts)" for numero in numeros] + ["NOTA FINAL", "JUSTIFICACIÓN Y OBSERVACIONES"]
        if revisiones is not None:
            encabezados.append('REVISIÓN DOCENTE')
        bloques = ["SISTEMA DE CALIFICACIÓN ACADÉMICA", f"Facultad: {contexto.get('facultad', '')} | Escuela: {contexto.get('escuela', '')}", f"Año: {contexto.get('anio', '')} | Ciclo/Promoción: {contexto.get('ciclo', '')}", f"Curso: {contexto.get('curso', '')} | Evaluación: {contexto.get('evaluacion', '')}", f"Fecha de Emisión: {datetime.now(ZoneInfo('America/Lima')):%d/%m/%Y}"]
        for fila, texto in enumerate(bloques, 1):
            hoja.cell(fila, 1, texto).data_type = "s"
            hoja.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=len(encabezados))
        for columna, titulo in enumerate(encabezados, 1):
            celda = hoja.cell(7, columna, titulo)
            celda.fill = PatternFill("solid", fgColor="17365D")
            celda.font = Font(color="FFFFFF", bold=True)
        for orden, examen in enumerate(examenes, 1):
            detalle = {pregunta.numero_pregunta: pregunta for pregunta in examen.preguntas}
            justificaciones = [f"P{numero}: {pregunta.respuesta_detectada} — {pregunta.justificacion}" for numero, pregunta in detalle.items()]
            valores = [orden, examen.codigo_estudiante, examen.nombre_estudiante] + [float(detalle[numero].puntaje_obtenido) if numero in detalle else 0 for numero in numeros] + [float(examen.nota_final), "\n".join([examen.observaciones_generales, *justificaciones])]
            if revisiones is not None:
                valores.append('Revisada' if revisiones[orden - 1] else 'Pendiente')
            for columna, valor in enumerate(valores, 1):
                celda = hoja.cell(orden + 7, columna, valor)
                if isinstance(valor, str):
                    celda.data_type = "s"
                celda.alignment = Alignment(vertical="top", wrap_text=True)
                if 3 < columna <= len(numeros) + 4:
                    celda.number_format = "0.00"
        indice_nota = len(encabezados) - (2 if revisiones is not None else 1)
        columna_nota = get_column_letter(indice_nota)
        if examenes:
            rango = f"{columna_nota}8:{columna_nota}{len(examenes) + 7}"
            for desplazamiento, (titulo, formula) in enumerate([("Promedio del Grupo", f"AVERAGE({rango})"), ("Nota Más Alta", f"MAX({rango})"), ("Nota Más Baja", f"MIN({rango})"), ("Aprobados", f'COUNTIF({rango},">=10.5")')]):
                fila = len(examenes) + 9 + desplazamiento
                hoja.cell(fila, 3, titulo)
                hoja.cell(fila, indice_nota, f"={formula}").number_format = "0.00"
        for columna in range(1, len(encabezados) + 1):
            hoja.column_dimensions[get_column_letter(columna)].width = 18
        hoja.column_dimensions["C"].width = 34
        hoja.column_dimensions[get_column_letter(indice_nota + 1)].width = 70
        hoja.freeze_panes = "D8"
        hoja.auto_filter.ref = f"A7:{get_column_letter(len(encabezados))}{max(7, len(examenes) + 7)}"
        contenido = BytesIO()
        libro.save(contenido)
        return contenido.getvalue()
