from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePath
from zipfile import ZipFile, BadZipFile
import base64
from PIL import Image as Imagen, ImageOps as OperacionesImagen
from pypdf import PdfReader
from docx import Document as DocumentoWord
import pypdfium2 as pdfium


@dataclass(frozen=True)
class DocumentoExtraido:
    tipo: str
    paginas: int
    texto: str
    imagenes: tuple[str, ...]


def convertir_imagen(imagen) -> str:
    if imagen.width * imagen.height > 24000000:
        raise ValueError('La imagen excede 24 megapíxeles')
    imagen = OperacionesImagen.exif_transpose(imagen).convert('RGB')
    imagen.thumbnail((1800,1800))
    salida = BytesIO()
    imagen.save(salida,format='JPEG',quality=85)
    return base64.b64encode(salida.getvalue()).decode('ascii')


def crear_pdf_fotos(archivos: list[tuple[str, bytes]], rotaciones: list[int]) -> bytes:
    if not 1 <= len(archivos) <= 20 or len(archivos) != len(rotaciones):
        raise ValueError('Selecciona entre 1 y 20 fotos y revisa sus rotaciones.')
    paginas = []
    try:
        for (nombre, contenido), rotacion in zip(archivos, rotaciones):
            if rotacion not in (0, 90, 180, 270):
                raise ValueError('La rotación de una foto no es válida.')
            documento = ExtraerDocumento().extraer(nombre, contenido)
            if documento.tipo != 'imagen':
                raise ValueError('Para agrupar páginas selecciona únicamente fotos JPG, PNG o WEBP.')
            with Imagen.open(BytesIO(base64.b64decode(documento.imagenes[0]))) as imagen:
                paginas.append(imagen.rotate(-rotacion, expand=True).convert('RGB'))
        salida = BytesIO()
        paginas[0].save(salida, format='PDF', save_all=True, append_images=paginas[1:], resolution=100, quality=65)
        if len(salida.getvalue()) > 3 * 1024 * 1024:
            raise ValueError('Las fotos agrupadas superan 3 MB. Reduce el tamaño o la cantidad de fotos.')
        return salida.getvalue()
    finally:
        for pagina in paginas:
            pagina.close()


class ExtraerDocumento:
    def extraer(self, nombre: str, contenido: bytes) -> DocumentoExtraido:
        if not contenido or len(contenido) > 3 * 1024 * 1024:
            raise ValueError('Cada archivo debe pesar entre 1 byte y 3 MB')
        extension = PurePath(nombre).suffix.lower()
        try:
            if extension in ('.jpg','.jpeg','.png','.webp'):
                with Imagen.open(BytesIO(contenido)) as imagen:
                    if imagen.format not in ('JPEG','PNG','WEBP'):
                        raise ValueError('Formato de imagen no permitido')
                    return DocumentoExtraido('imagen',1,'',(convertir_imagen(imagen),))
            if extension == '.pdf' and contenido.startswith(b'%PDF-'):
                lector = PdfReader(BytesIO(contenido))
                if lector.is_encrypted or not 1 <= len(lector.pages) <= 20:
                    raise ValueError('El PDF debe tener de 1 a 20 páginas y no estar cifrado')
                texto = '\n'.join(pagina.extract_text() or '' for pagina in lector.pages)
                if len(texto) > 80000:
                    raise ValueError('El PDF supera 80.000 caracteres')
                imagenes = []
                with pdfium.PdfDocument(contenido) as documento:
                    for pagina in documento:
                        ancho, alto = pagina.get_size()
                        if ancho <= 0 or alto <= 0:
                            raise ValueError('Página PDF inválida')
                        mapa = pagina.render(scale=min(2,1800/max(ancho,alto)))
                        imagenes.append(convertir_imagen(mapa.to_pil()))
                        mapa.close(); pagina.close()
                return DocumentoExtraido('pdf',len(lector.pages),texto,tuple(imagenes))
            if extension == '.docx':
                with ZipFile(BytesIO(contenido)) as paquete:
                    entradas = paquete.infolist()
                    if len(entradas)>1000 or sum(entrada.file_size for entrada in entradas)>20000000:
                        raise ValueError('El Word expandido supera el límite de seguridad')
                    documento = DocumentoWord(BytesIO(contenido))
                    texto = '\n'.join([parrafo.text for parrafo in documento.paragraphs]+[' | '.join(celda.text for celda in fila.cells) for tabla in documento.tables for fila in tabla.rows])
                    imagenes=[]
                    for entrada in entradas:
                        if entrada.filename.startswith('word/media/'):
                            with Imagen.open(BytesIO(paquete.read(entrada))) as imagen:
                                imagenes.append(convertir_imagen(imagen))
                            if len(imagenes)>20:
                                raise ValueError('El Word contiene demasiadas imágenes')
                    if not texto.strip() and not imagenes:
                        raise ValueError('El Word no contiene texto ni imágenes legibles')
                    if len(texto)>80000:
                        raise ValueError('El Word supera 80.000 caracteres')
                    paginas = max(1,len(imagenes),(len(texto)+2999)//3000)
                    if paginas > 20:
                        raise ValueError('El Word supera 20 páginas estimadas')
                    return DocumentoExtraido('word',paginas,texto,tuple(imagenes))
        except (ValueError, BadZipFile, OSError, Exception) as error:
            if isinstance(error, ValueError):
                raise
            raise ValueError('El archivo no es válido o está dañado') from None
        raise ValueError('Usa JPG, PNG, WEBP, PDF o DOCX')
