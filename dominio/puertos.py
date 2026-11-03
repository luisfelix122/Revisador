from typing import Protocol
from dominio.calificacion import ExamenEstudiante


class ErrorProveedor(Exception):
    """Error seguro para mostrar sin revelar credenciales ni respuestas remotas."""


class IProveedorVisionIA(Protocol):
    async def comprobar(self, clave: str, modelo: str) -> None: ...
    async def listar_modelos(self, clave: str) -> list[str]: ...


class IGeneradorExcel(Protocol):
    def generar(self, contexto: dict[str, str], examenes: tuple[ExamenEstudiante, ...]) -> bytes: ...
