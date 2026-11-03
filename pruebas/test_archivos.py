from io import BytesIO
import pytest
from PIL import Image as Imagen
from infraestructura.archivos import ExtraerDocumento


def test_valida_firma_y_rechaza_archivos_disfrazados():
    with pytest.raises(ValueError):
        ExtraerDocumento().extraer('foto.png', b'no es una imagen')
    memoria = BytesIO()
    Imagen.new('RGB',(8,8),'white').save(memoria,format='PNG')
    documento = ExtraerDocumento().extraer('foto.png',memoria.getvalue())
    assert documento.paginas == 1
    assert documento.tipo == 'imagen'
    assert len(documento.imagenes) == 1
