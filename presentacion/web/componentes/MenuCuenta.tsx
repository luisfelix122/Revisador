import { useCallback as usarCallback, useEffect as usarEfecto, useRef as usarReferencia, useState as usarEstado } from "react";
import { LogOut as Salir, UserRound as Usuario } from "lucide-react";
import { Ventana } from "./Ventana";

interface Propiedades {
  nombre: string;
  correo: string;
  alGuardar?: (nombre: string) => Promise<void>;
  alSalir?: () => void;
}

export function MenuCuenta({ nombre, correo, alGuardar, alSalir }: Propiedades) {
  const [abierto, abrir] = usarEstado(false);
  const [editando, editar] = usarEstado(false);
  const [nombreNuevo, cambiarNombre] = usarEstado(nombre);
  const [guardando, guardar] = usarEstado(false);
  const [error, mostrarError] = usarEstado("");
  const [mensaje, mostrarMensaje] = usarEstado("");
  const contenedor = usarReferencia<HTMLDivElement>(null);
  const boton = usarReferencia<HTMLButtonElement>(null);
  const cerrarPerfil = usarCallback(() => { editar(false); boton.current?.focus(); }, []);

  usarEfecto(() => {
    if (!abierto) return;
    const fuera = (evento: PointerEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) abrir(false);
    };
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") { abrir(false); boton.current?.focus(); }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", teclado);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", teclado); };
  }, [abierto]);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const limpio = nombreNuevo.trim();
    if (!limpio) { mostrarError("Escribe tu nombre para guardar los cambios."); return; }
    if (!alGuardar) return;
    guardar(true); mostrarError(""); mostrarMensaje("");
    try { await alGuardar(limpio); mostrarMensaje("Tu perfil se actualizó correctamente."); }
    catch { mostrarError("No se pudo guardar tu perfil. Inténtalo otra vez."); }
    finally { guardar(false); }
  };

  return <div className="cuenta-contenedor" ref={contenedor}>
    <button ref={boton} type="button" className="avatar" aria-label={nombre ? `Cuenta de ${nombre}` : "Espacio del profesor"} title="Cuenta" aria-expanded={abierto} aria-controls="menu-cuenta" onClick={() => abrir(!abierto)}>{nombre.trim().charAt(0).toLocaleUpperCase("es") || "P"}</button>
    {abierto && <div id="menu-cuenta" className="menu-cuenta">
      <div className="cuenta-identidad"><strong>{nombre || "Cuenta docente"}</strong>{correo && <span>{correo}</span>}</div>
      {alGuardar && <button type="button" onClick={() => { cambiarNombre(nombre); mostrarError(""); mostrarMensaje(""); abrir(false); editar(true); }}><Usuario size={18} /> Editar perfil</button>}
      {alSalir && <button type="button" onClick={() => { abrir(false); alSalir(); }}><Salir size={18} /> Cerrar sesión</button>}
    </div>}
    {editando && <Ventana titulo="Editar perfil" cerrar={cerrarPerfil}>
      <form className="contenido-ventana perfil-formulario" onSubmit={(evento) => void enviar(evento)}>
        <p>Personaliza cómo aparece tu nombre en Revisador.</p>
        <label>Nombre para mostrar<input value={nombreNuevo} onChange={(evento) => cambiarNombre(evento.target.value)} maxLength={100} required autoComplete="name" /></label>
        <label>Correo de la cuenta<input type="email" value={correo} readOnly /></label>
        <p className="perfil-ayuda">El correo es el que utilizas para iniciar sesión.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {mensaje && <p className="exito" role="status">{mensaje}</p>}
        <div className="perfil-acciones"><button type="button" className="boton-contorno" onClick={cerrarPerfil} disabled={guardando}>Cerrar</button><button className="boton-primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button></div>
      </form>
    </Ventana>}
  </div>;
}
