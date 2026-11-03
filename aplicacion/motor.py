from decimal import Decimal
from dominio.calificacion import DetallePregunta, ExamenEstudiante


def validar_resultado(datos: dict, rubrica: list[dict]) -> ExamenEstudiante:
    from aplicacion.dto_ia import SalidaCalificacion
    datos = SalidaCalificacion.model_validate(datos).model_dump()
    maximos = {int(criterio['numero_pregunta']): Decimal(str(criterio['puntaje_maximo'])) for criterio in rubrica}
    preguntas = tuple(DetallePregunta(int(pregunta['numero_pregunta']), Decimal(str(pregunta['puntaje_obtenido'])), Decimal(str(pregunta['puntaje_maximo'])), pregunta['respuesta_detectada'], pregunta['justificacion']) for pregunta in datos['preguntas'])
    if {pregunta.numero_pregunta for pregunta in preguntas} != set(maximos):
        raise ValueError('La respuesta no contiene exactamente las preguntas de la rúbrica')
    if any(pregunta.puntaje_maximo != maximos[pregunta.numero_pregunta] for pregunta in preguntas):
        raise ValueError('La IA cambió el puntaje máximo de la rúbrica')
    return ExamenEstudiante(datos['nombre_estudiante'], datos['codigo_estudiante'], preguntas, datos['observaciones_generales'])
