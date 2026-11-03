from dominio.puertos import IProveedorVisionIA


class ValidarConexionApi:
    def __init__(self, proveedor: IProveedorVisionIA):
        self.proveedor = proveedor

    async def ejecutar(self, clave: str, modelo: str) -> None:
        await self.proveedor.comprobar(clave, modelo)
