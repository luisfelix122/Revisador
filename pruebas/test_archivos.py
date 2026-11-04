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


def test_pdf_con_texto_excesivo_no_se_trunca_silenciosamente():
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    escritor = PdfWriter()
    pagina = escritor.add_blank_page(width=200, height=200)
    fuente = DictionaryObject({NameObject('/Type'):NameObject('/Font'), NameObject('/Subtype'):NameObject('/Type1'), NameObject('/BaseFont'):NameObject('/Helvetica')})
    pagina[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):escritor._add_object(fuente)})})
    contenido = DecodedStreamObject()
    contenido.set_data(b'BT /F1 12 Tf 10 180 Td (' + b'A' * 81000 + b') Tj ET')
    pagina[NameObject('/Contents')] = escritor._add_object(contenido)
    archivo = BytesIO()
    escritor.write(archivo)
    with pytest.raises(ValueError, match='80.000'):
        ExtraerDocumento().extraer('solucion.pdf', archivo.getvalue())


def test_word_con_mas_de_20_paginas_estimadas_se_rechaza_antes_de_subir():
    from docx import Document
    documento = Document()
    documento.add_paragraph('A' * 61000)
    archivo = BytesIO()
    documento.save(archivo)
    with pytest.raises(ValueError, match='20 páginas'):
        ExtraerDocumento().extraer('solucion.docx', archivo.getvalue())
