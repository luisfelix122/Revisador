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
    [error, mostrarError] = usarEstado("");
  const padres =
    nivel === 1
      ? anios.map((a) => ({ id: a.id, nombre: String(a.anio) }))
      : nivel === 2
        ? anios.flatMap((a) => a.facultades)
        : nivel === 3
          ? anios.flatMap((a) => a.facultades.flatMap((f) => f.escuelas))
          : anios.flatMap((a) =>
              a.facultades.flatMap((f) =>
                f.escuelas.flatMap((e) =>
                  e.promociones_ciclos.map((c) => ({
                    id: c.id,
                    nombre: c.denominacion,
                  })),
                ),
              ),
            );
  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    ocupar(true);
    mostrarError("");
    try {
      await servicio.crearNodo(
        niveles[nivel][0],
        nombre,
        nivel ? padre : undefined,
      );
      await alGuardar();
      cambiarNombre("");
    } catch (problema) {
      mostrarError(
        problema instanceof Error ? problema.message : "No se pudo guardar",
      );
    } finally {
      ocupar(false);
    }
  };
  return (
    <Ventana titulo="Organizar biblioteca" cerrar={cerrar}>
      <form className="contenido-ventana" onSubmit={guardar}>
        <p className="descripcion">
          Crea la estructura de tus cursos, desde el año hasta la asignatura.
        </p>
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
    </Ventana>
  );
}
