import { useState as usarEstado } from "react";
import { Ventana } from "./Ventana";
import { ServicioBiblioteca, type Anio } from "../servicios/biblioteca";

const niveles = [
  ["anios_academicos", "Año académico"], ["facultades", "Facultad"],
  ["escuelas", "Escuela profesional"], ["promociones_ciclos", "Promoción / ciclo"], ["cursos", "Curso"],
] as const;
const NUEVO = "__nuevo__";
const normalizar = (texto: string) => texto.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
function parecido(primero: string, segundo: string) {
  const a = normalizar(primero), b = normalizar(segundo);
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0, j = 0, diferencias = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diferencias > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return diferencias + Number(i < a.length || j < b.length) <= 1;
}

export function OrganizarBiblioteca({ servicio, anios, cerrar, alGuardar }: {
  servicio: ServicioBiblioteca; anios: Anio[]; cerrar: () => void; alGuardar: () => Promise<void>;
}) {
  const [selecciones, cambiarSelecciones] = usarEstado<string[]>([]);
  const [nombre, cambiarNombre] = usarEstado("");
  const [ocupado, ocupar] = usarEstado(false);
  const [error, mostrarError] = usarEstado("");
  const [exito, mostrarExito] = usarEstado("");
  const [confirmarParecido, cambiarConfirmarParecido] = usarEstado(false);
  const anio = anios.find((item) => item.id === selecciones[0]);
  const facultad = anio?.facultades?.find((item) => item.id === selecciones[1]);
  const escuela = facultad?.escuelas?.find((item) => item.id === selecciones[2]);
  const ciclo = escuela?.promociones_ciclos?.find((item) => item.id === selecciones[3]);
  const opciones = [
    anios.map((item) => ({id:item.id,nombre:String(item.anio)})),
    (anio?.facultades || []).map((item) => ({id:item.id,nombre:item.nombre})),
    (facultad?.escuelas || []).map((item) => ({id:item.id,nombre:item.nombre})),
    (escuela?.promociones_ciclos || []).map((item) => ({id:item.id,nombre:item.denominacion})),
    (ciclo?.cursos || []).map((item) => ({id:item.id,nombre:item.nombre})),
  ];
  const cambiarSeleccion = (indice: number, valor: string) => {
    cambiarSelecciones((previas) => [...previas.slice(0, indice), valor]);
    cambiarNombre(""); cambiarConfirmarParecido(false); mostrarError(""); mostrarExito("");
  };
  const guardar = async (indice: number, evento: React.FormEvent) => {
    evento.preventDefault();
    const limpio = nombre.trim().replace(/\s+/g, " ");
    if (opciones[indice].some((item) => normalizar(item.nombre) === normalizar(limpio))) {
      mostrarError("Ya existe un elemento con ese nombre en esta ubicación."); return;
    }
    const similar = indice !== 3 && opciones[indice].find((item) => parecido(item.nombre, limpio));
    if (similar && !confirmarParecido) {
      mostrarError(`Ya existe un nombre parecido: «${similar.nombre}». Confirma si se trata de otro elemento.`); return;
    }
    if (indice === 3 && (/[,;\n]/.test(limpio) || /\s(y|e)\s/i.test(limpio))) {
      mostrarError("Ingresa un solo ciclo a la vez."); return;
    }
    ocupar(true); mostrarError(""); mostrarExito("");
    try {
      const creado = await servicio.crearNodo(niveles[indice][0], limpio, indice ? selecciones[indice - 1] : undefined) as {id:string};
      await alGuardar();
      cambiarSelecciones((previas) => [...previas.slice(0, indice), creado.id]);
      cambiarNombre(""); cambiarConfirmarParecido(false); mostrarExito(`${niveles[indice][1]} guardado.`);
    } catch (problema) {
      mostrarError(problema instanceof Error ? problema.message : "No se pudo guardar.");
    } finally { ocupar(false); }
  };
  return (
    <Ventana titulo="Organizar cursos" cerrar={cerrar}>
      <div className="contenido-ventana">
        <p className="descripcion">Elige o crea cada nivel para continuar. Solo verás las opciones de la ubicación seleccionada.</p>
        {niveles.map(([clave, titulo], indice) => {
          if (indice > 0 && (!selecciones[indice - 1] || selecciones[indice - 1] === NUEVO)) return null;
          const valor = selecciones[indice] || "";
          return <div key={clave} className="organizar-nivel">
            <label>{titulo}<select value={valor} disabled={ocupado} onChange={(evento) => cambiarSeleccion(indice, evento.target.value)}>
              <option value="">Selecciona {titulo.toLocaleLowerCase("es")}</option>
              {opciones[indice].map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              <option value={NUEVO}>+ Crear {titulo.toLocaleLowerCase("es")}</option>
            </select></label>
            {valor === NUEVO && <form onSubmit={(evento) => void guardar(indice, evento)}>
              <label>Nombre de {titulo.toLocaleLowerCase("es")}<input required maxLength={100} inputMode={indice === 0 ? "numeric" : "text"} value={nombre} onChange={(evento) => { cambiarNombre(evento.target.value); cambiarConfirmarParecido(false); mostrarError(""); }} placeholder={indice === 0 ? "Ej. 2026" : "Escribe un nombre"} /></label>
              {error.includes('nombre parecido') && <label className="casilla"><input type="checkbox" checked={confirmarParecido} onChange={(evento) => cambiarConfirmarParecido(evento.target.checked)} />Es un elemento diferente</label>}
              <button className="boton-primario" disabled={ocupado || !nombre.trim()}>{ocupado ? "Guardando…" : `Crear ${titulo.toLocaleLowerCase("es")}`}</button>
            </form>}
          </div>;
        })}
        {exito && <p role="status" className="exito">{exito}</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    </Ventana>
  );
}
