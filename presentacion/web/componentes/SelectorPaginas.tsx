import { useEffect as usarEfecto, useRef as usarReferencia, useState as usarEstado } from "react";
import { ArrowDown as Bajar, ArrowUp as Subir, RotateCw as Girar, Trash2 as Quitar, Images as Fotos, Camera as Camara } from "lucide-react";

export interface PaginaExamen { id: string; archivo: File; vista: string; rotacion: number }
let secuencia = 0;

export function SelectorPaginas({ paginas, alCambiar, deshabilitado = false, permitirPdf = false }: {
  paginas: PaginaExamen[]; alCambiar: (paginas: PaginaExamen[]) => void; deshabilitado?: boolean; permitirPdf?: boolean;
}) {
  const input = usarReferencia<HTMLInputElement>(null);
  const camara = usarReferencia<HTMLInputElement>(null);
  const [error, mostrarError] = usarEstado("");
  const disponibles = usarReferencia(new Set<string>());
  usarEfecto(() => () => { for (const url of disponibles.current) URL.revokeObjectURL?.(url); }, []);
  usarEfecto(() => { const activas = new Set(paginas.map(p => p.vista)); for (const url of disponibles.current) if (!activas.has(url)) { URL.revokeObjectURL?.(url); disponibles.current.delete(url); } }, [paginas]);
  const seleccionar = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = "";
    if (!archivos.length) return;
    const todos = [...paginas.map((pagina) => pagina.archivo), ...archivos];
    if (todos.length > 20 || todos.some((archivo) => !/\.(jpe?g|png|webp|pdf)$/i.test(archivo.name)) || (todos.some((archivo) => /\.pdf$/i.test(archivo.name)) && (todos.length !== 1 || !permitirPdf))) {
      mostrarError(permitirPdf ? "Selecciona hasta 20 fotos JPG, PNG o WEBP, o un solo PDF." : "Selecciona hasta 20 fotos JPG, PNG o WEBP.");
      return;
    }
    mostrarError("");
    const nuevas = archivos.map((archivo) => {
      const vista = typeof URL.createObjectURL === "function" ? URL.createObjectURL(archivo) : "";
      if (vista) disponibles.current.add(vista);
      return {id: String(++secuencia), archivo, vista, rotacion: 0};
    });
    alCambiar([...paginas, ...nuevas]);
  };
  const modificar = (indice: number, accion: "quitar" | "girar" | "subir" | "bajar") => {
    const copia = [...paginas];
    if (accion === "quitar") {
      const [retirada] = copia.splice(indice, 1);
      if (retirada.vista) { URL.revokeObjectURL?.(retirada.vista); disponibles.current.delete(retirada.vista); }
    } else if (accion === "girar") copia[indice] = {...copia[indice], rotacion: (copia[indice].rotacion + 90) % 360};
    else { const destino = indice + (accion === "subir" ? -1 : 1); [copia[indice], copia[destino]] = [copia[destino], copia[indice]]; }
    alCambiar(copia);
  };
  return <div className="selector-paginas">
    <input ref={input} type="file" accept={permitirPdf ? ".jpg,.jpeg,.png,.webp,.pdf" : ".jpg,.jpeg,.png,.webp"} multiple onChange={seleccionar} className="solo-lectores" aria-label="Seleccionar fotos del examen" disabled={deshabilitado} />
    <input ref={camara} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={seleccionar} className="solo-lectores" aria-label="Tomar foto del examen" disabled={deshabilitado} />
    <button type="button" className="boton-contorno" onClick={() => input.current?.click()} disabled={deshabilitado || paginas.length >= 20 || paginas.some(p => /\.pdf$/i.test(p.archivo.name))}><Fotos size={17} /> {paginas.length ? "Agregar fotos" : permitirPdf ? "Seleccionar fotos o PDF" : "Seleccionar fotos"}</button>
    <button type="button" className="boton-contorno boton-camara" onClick={() => camara.current?.click()} disabled={deshabilitado || paginas.length >= 20 || paginas.some(p => /\.pdf$/i.test(p.archivo.name))}><Camara size={17} /> Tomar foto</button>
    {error && <p role="alert" className="error">{error}</p>}
    <p className="ayuda-campo">Hasta 20 fotos por examen. Puedes agregarlas poco a poco, ordenarlas y girarlas.{permitirPdf ? " También puedes subir un PDF." : ""}</p>
    {paginas.length > 0 && <ol className="lista-paginas">{paginas.map((pagina, indice) => <li key={pagina.id}>
      {pagina.vista && !/\.pdf$/i.test(pagina.archivo.name) ? <img src={pagina.vista} alt={`Vista previa de la página ${indice + 1}`} style={{transform:`rotate(${pagina.rotacion}deg)`}} /> : <span className="pagina-pdf">PDF</span>}
      <span className="pagina-nombre"><strong>Página {indice + 1}</strong><span>{pagina.archivo.name}</span></span>
      <div className="pagina-acciones">
        {!/\.pdf$/i.test(pagina.archivo.name) && <button type="button" className="boton-icono pequeno" aria-label={`Girar página ${indice + 1}`} title="Girar" disabled={deshabilitado} onClick={() => modificar(indice,"girar")}><Girar size={16}/></button>}
        <button type="button" className="boton-icono pequeno" aria-label={`Subir página ${indice + 1}`} title="Subir" disabled={deshabilitado || indice===0} onClick={() => modificar(indice,"subir")}><Subir size={16}/></button>
        <button type="button" className="boton-icono pequeno" aria-label={`Bajar página ${indice + 1}`} title="Bajar" disabled={deshabilitado || indice===paginas.length-1} onClick={() => modificar(indice,"bajar")}><Bajar size={16}/></button>
        <button type="button" className="boton-icono pequeno" aria-label={`Quitar página ${indice + 1}`} title="Quitar" disabled={deshabilitado} onClick={() => modificar(indice,"quitar")}><Quitar size={16}/></button>
      </div>
    </li>)}</ol>}
  </div>;
}

async function comprimirFoto(archivo: File, lado: number, calidad: number): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    await new Promise<void>((resolver, rechazar) => { imagen.onload = () => resolver(); imagen.onerror = () => rechazar(new Error(`No se pudo leer ${archivo.name}.`)); imagen.src = url; });
    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const lienzo = document.createElement("canvas"); lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala)); lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("No se pudieron preparar las fotos en este dispositivo.");
    contexto.fillStyle = "#fff"; contexto.fillRect(0, 0, lienzo.width, lienzo.height); contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return await new Promise<Blob>((resolver, rechazar) => lienzo.toBlob((blob) => blob ? resolver(blob) : rechazar(new Error("No se pudo preparar una foto.")), "image/jpeg", calidad));
  } finally { URL.revokeObjectURL(url); }
}

export async function prepararFotos(paginas: PaginaExamen[]): Promise<FormData> {
  const formulario = new FormData();
  let fotos: Blob[] = [];
  for (const [lado, calidad] of [[1600, 0.7], [1200, 0.5]]) {
    fotos = [];
    for (const pagina of paginas) fotos.push(await comprimirFoto(pagina.archivo, lado, calidad));
    if (fotos.reduce((suma, foto) => suma + foto.size, 0) <= 3.8 * 1024 * 1024) break;
  }
  if (fotos.reduce((suma, foto) => suma + foto.size, 0) > 3.8 * 1024 * 1024) throw new Error("Las fotos son demasiado grandes incluso después de prepararlas. Reduce su cantidad.");
  fotos.forEach((foto, indice) => formulario.append("archivos", foto, `pagina-${indice + 1}.jpg`));
  formulario.append("rotaciones", JSON.stringify(paginas.map((pagina) => pagina.rotacion)));
  return formulario;
}
