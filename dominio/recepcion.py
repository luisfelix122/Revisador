from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID


def recepcion_finalizada(evaluacion: dict, ahora: datetime | None = None) -> bool:
    examenes = evaluacion.get('examenes_estudiantes') or []
    if evaluacion.get('modalidad_recepcion') == 'manual':
        return bool(examenes and evaluacion.get('carga_manual_finalizada'))
    if not evaluacion.get('recepcion_iniciada'):
        return False
    cupo = evaluacion.get('cantidad_estudiantes_esperados')
    cierre = evaluacion.get('fecha_cierre_programada')
    vencida = False
    if cierre:
        try:
            fecha = datetime.fromisoformat(str(cierre).replace('Z', '+00:00'))
            vencida = fecha.tzinfo is not None and fecha <= (ahora or datetime.now(timezone.utc))
        except (ValueError, TypeError):
            vencida = False
    return bool(not evaluacion.get('recepcion_abierta') or vencida or (cupo and len(examenes) >= cupo))


class ErrorEntregaCerrada(Exception):
    """Lanzada cuando el plazo de entrega está cerrado o expiró."""
    pass


class ErrorEntregaDuplicada(Exception):
    """Lanzada cuando un estudiante ya entregó y no cuenta con permiso de reenvío."""
    pass


class ErrorCupoAlumnosSuperado(Exception):
    """Lanzada cuando se supera el límite de alumnos que van a dar el examen en el aula."""
    pass


@dataclass(frozen=True)
class EntregaEstudiante:
    codigo_estudiante: str
    nombre_estudiante: str
    ruta_archivo: str

    def __post_init__(self):
        codigo = (self.codigo_estudiante or "").strip()
        if not codigo or codigo.lower() == "nada":
            raise ValueError("El código de estudiante es obligatorio para la entrega.")
        object.__setattr__(self, "codigo_estudiante", codigo)
        nombre = (self.nombre_estudiante or "").strip()
        object.__setattr__(self, "nombre_estudiante", nombre or "nada")
        if not self.ruta_archivo or not self.ruta_archivo.strip():
            raise ValueError("La ruta del archivo entregado es obligatoria.")


@dataclass(frozen=True)
class ControlRecepcionEvaluacion:
    token_recepcion: UUID
    recepcion_abierta: bool
    tiempo_limite_minutos: int | None
    fecha_cierre_programada: datetime | None
    permitir_reenvios_global: bool
    cantidad_estudiantes_esperados: int | None = None

    def esta_activa(self, ahora: datetime | None = None) -> bool:
        if not self.recepcion_abierta:
            return False
        if self.fecha_cierre_programada is None:
            return True
        momento = ahora or datetime.now(timezone.utc)
        return momento <= self.fecha_cierre_programada

    def validar_nueva_entrega(
        self,
        codigo_estudiante: str,
        ya_entregado: bool,
        permitir_reenvio_individual: bool = False,
        entregas_anteriores: int = 1,
        total_estudiantes_actuales: int = 0,
        ahora: datetime | None = None,
    ) -> int:
        if not self.esta_activa(ahora):
            raise ErrorEntregaCerrada("La recepción de entregas para esta evaluación se encuentra cerrada.")

        if not ya_entregado:
            if (
                self.cantidad_estudiantes_esperados is not None
                and total_estudiantes_actuales >= self.cantidad_estudiantes_esperados
            ):
                raise ErrorCupoAlumnosSuperado(
                    f"Se ha alcanzado el límite de estudiantes esperados ({self.cantidad_estudiantes_esperados} alumnos) "
                    "para este examen. Si estás en el aula, consulta con tu docente."
                )
            return 1

        if ya_entregado:
            if not (permitir_reenvio_individual or self.permitir_reenvios_global):
                raise ErrorEntregaDuplicada(
                    f"El estudiante con código '{codigo_estudiante}' ya entregó su examen. "
                    "Solicita permiso a tu docente para poder reenviarlo."
                )
            return entregas_anteriores + 1


def filtrar_examenes_a_calificar(
    examenes: list[dict],
    modo: str = "pendientes",
    seleccionados: list[str] | None = None,
) -> list[dict]:
    """Filtra exámenes según el criterio seleccionado por el docente:

    - 'pendientes': únicamente los exámenes que aún no tienen calificación completada.
    - 'todos': recalifica todo el lote de exámenes.
    - 'seleccionados': únicamente los exámenes cuyos identificadores están en la lista.
    """
    if modo == "pendientes":
        return [e for e in examenes if e.get("estado_revision") != "completado"]
    elif modo == "todos":
        return list(examenes)
    elif modo == "seleccionados":
        ids_seleccionados = set(str(identificador) for identificador in (seleccionados or []))
        return [e for e in examenes if str(e.get("id")) in ids_seleccionados]
    else:
        raise ValueError(f"Modo de calificación desconocido: '{modo}'")
