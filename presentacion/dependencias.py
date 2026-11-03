from infraestructura.proveedores import ProveedorHTTP
from presentacion.esquemas import ConfiguracionIA
from infraestructura.excel import GeneradorExcel


def obtener_proveedor(configuracion: ConfiguracionIA) -> ProveedorHTTP:
    return ProveedorHTTP(configuracion.proveedor)


def obtener_generador() -> GeneradorExcel:
    return GeneradorExcel()
