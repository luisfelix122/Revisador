import { useState as usarEstado } from "react";
import { Ventana } from "./Ventana";
import { ServicioBiblioteca, type Anio } from "../servicios/biblioteca";

const niveles = [
  ["anios_academicos", "Año académico"],
  ["facultades", "Facultad"],
  ["escuelas", "Escuela profesional"],
  ["promociones_ciclos", "Promoción / ciclo"],
  ["cursos", "Curso"],
];
export function OrganizarBiblioteca({
  servicio,
  anios,
  cerrar,
  alGuardar,
}: {
  servicio: ServicioBiblioteca;
  anios: Anio[];
  cerrar: () => void;
  alGuardar: () => Promise<void>;
}) {
  const [nivel, cambiarNivel] = usarEstado(0),
    [nombre, cambiarNombre] = usarEstado(""),
    [padre, cambiarPadre] = usarEstado(""),
    [ocupado, ocupar] = usarEstado(false),
    [error, mostrarError] = usarEstado(""),
    [exito, mostrarExito] = usarEstado("");
  const padres =
    nivel === 1
      ? (anios || []).map((a) => ({ id: a.id, nombre: String(a.anio) }))
      : nivel === 2
        ? (anios || []).flatMap((a) => a.facultades || [])
        : nivel === 3
          ? (anios || []).flatMap((a) =>
              (a.facultades || []).flatMap((f) => f.escuelas || []),
            )
          : (anios || []).flatMap((a) =>
              (a.facultades || []).flatMap((f) =>
                (f.escuelas || []).flatMap((e) =>
                  (e.promociones_ciclos || []).map((c) => ({
                    id: c.id,
                    nombre: `${c.denominacion || "Ciclo"} (${f.nombre || "Facultad"})`,
                  })),
                ),
              ),
            );
  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    ocupar(true);
    mostrarError("");
    mostrarExito("");
    try {
      await servicio.crearNodo(
        niveles[nivel][0],
        nombre.trim(),
        nivel ? padre : undefined,
      );
      await alGuardar();
      const nombreCreado = nombre.trim();
      cambiarNombre("");
      mostrarExito(`¡${niveles[nivel][1]} "${nombreCreado}" guardado con éxito!`);
      if (nivel === 4) {
        window.setTimeout(() => cerrar(), 700);
      }
    } catch (problema) {
      mostrarError(
        problema instanceof Error ? problema.message : "No se pudo guardar",
      );
    } finally {
      ocupar(false);
    }
  };

  const cargarEjemplo = async () => {
    ocupar(true);
    mostrarError("");
    try {
      const anio = (await servicio.crearNodo(
        "anios_academicos",
        "2026",
      )) as { id: string };
      const facultad = (await servicio.crearNodo(
        "facultades",
        "Facultad de Ingeniería",
        anio.id,
      )) as { id: string };
      const escuela = (await servicio.crearNodo(
        "escuelas",
        "Ingeniería de Sistemas",
        facultad.id,
      )) as { id: string };
      const ciclo = (await servicio.crearNodo(
        "promociones_ciclos",
        "Ciclo 2026-I",
        escuela.id,
      )) as { id: string };
      await servicio.crearNodo(
        "cursos",
        "Algoritmos y Estructuras de Datos",
        ciclo.id,
      );
      await servicio.crearNodo("cursos", "Base de Datos", ciclo.id);
      await alGuardar();
      cerrar();
    } catch (problema) {
      mostrarError(
        problema instanceof Error
          ? problema.message
          : "No se pudo cargar la estructura de ejemplo",
      );
    } finally {
      ocupar(false);
    }
  };

  return (
    <Ventana titulo="Organizar biblioteca" cerrar={cerrar}>
      <div className="contenido-ventana">
        <p className="descripcion">
          Crea la estructura de tus cursos, desde el año hasta la asignatura.
        </p>

        {!anios.length && (
          <div
            style={{
              padding: "14px",
              background: "#e8f0fe",
              borderRadius: "8px",
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <strong style={{ color: "#1a73e8" }}>
              ¿Empezando desde cero?
            </strong>
            <p style={{ margin: 0, fontSize: "14px", color: "#202124" }}>
              Crea automáticamente una estructura inicial completa (Año 2026,
              Facultad de Ingeniería, Sistemas, Ciclo 2026-I y cursos de
              ejemplo):
            </p>
            <button
              type="button"
              className="boton-primario"
              disabled={ocupado}
              onClick={() => void cargarEjemplo()}
            >
              {ocupado
                ? "Generando estructura…"
                : "✨ Cargar estructura inicial recomendada"}
            </button>
          </div>
        )}

        <form onSubmit={guardar}>
        <label>
          Nivel
          <select
            value={nivel}
            onChange={(evento) => {
              cambiarNivel(Number(evento.target.value));
              cambiarPadre("");
            }}
          >
            {niveles.map(([, nombre], indice) => (
              <option key={indice} value={indice}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        {nivel > 0 && (
          <label>
            Nivel superior
            <select
              required
              value={padre}
              onChange={(evento) => cambiarPadre(evento.target.value)}
            >
              <option value="">Selecciona una ubicación</option>
              {padres.map((padre) => (
                <option key={padre.id} value={padre.id}>
                  {padre.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {niveles[nivel][1]}
          <input
            required
            maxLength={100}
            value={nombre}
            placeholder={nivel === 0 ? "2026" : "Escribe un nombre"}
            onChange={(evento) => cambiarNombre(evento.target.value)}
          />
        </label>
        {exito && (
          <p role="status" className="exito" style={{ margin: "12px 0" }}>
            {exito}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="boton-primario" disabled={ocupado}>
          {ocupado
            ? "Guardando…"
            : "Crear " + niveles[nivel][1].toLocaleLowerCase("es")}
        </button>
        <p className="ayuda-campo">
          Los cambios se guardan en tu biblioteca privada. Puedes crear otro
          nivel sin cerrar esta ventana.
        </p>
      </form>
    </div>
    </Ventana>
  );
}
