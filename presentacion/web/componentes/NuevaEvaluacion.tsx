import { useState as usarEstado } from "react";
import { Ventana } from "./Ventana";
import { ServicioBiblioteca, type Curso } from "../servicios/biblioteca";

export function NuevaEvaluacion({
  servicio,
  cursos,
  cerrar,
  alCrear,
  alOrganizar,
  cursoInicial,
}: {
  servicio: ServicioBiblioteca;
  cursos: Curso[];
  cerrar: () => void;
  alCrear: (id: string) => void;
  alOrganizar?: () => void;
  cursoInicial?: string;
}) {
  const [curso, cambiarCurso] = usarEstado(cursoInicial || ""),
    [titulo, cambiarTitulo] = usarEstado(""),
    [indicaciones, cambiarIndicaciones] = usarEstado(""),
    [maximo, cambiarMaximo] = usarEstado("20"),
    [ocupado, ocupar] = usarEstado(false),
    [error, mostrarError] = usarEstado("");
  const crear = async (evento: React.FormEvent) => {
    evento.preventDefault();
    ocupar(true);
    mostrarError("");
    try {
      const resultado = await servicio.crearEvaluacion({
        curso_id: curso,
        titulo,
        indicaciones_profesor: indicaciones,
        puntaje_total_maximo: Number(maximo),
      });
      alCrear(resultado.id);
    } catch (problema) {
      mostrarError(
        problema instanceof Error ? problema.message : "No se pudo crear",
      );
    } finally {
      ocupar(false);
    }
  };
  return (
    <Ventana titulo="Nueva evaluación" cerrar={cerrar}>
      <form className="contenido-ventana" onSubmit={crear}>
        {cursoInicial ? <p className="descripcion">Curso: <strong>{cursos.find((item) => item.id === cursoInicial)?.nombre}</strong></p> : <label>
          Curso
          <select
            required
            value={curso}
            onChange={(evento) => cambiarCurso(evento.target.value)}
          >
            <option value="">Selecciona un curso</option>
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.nombre}
              </option>
            ))}
          </select>
        </label>}
        {!cursos.length && (
          <div style={{ margin: "10px 0", padding: "12px", background: "#f8f9fa", border: "1px solid #dadce0", borderRadius: "8px" }}>
            <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#5f6368" }}>
              Aún no tienes cursos creados en tu biblioteca académica.
            </p>
            {alOrganizar && (
              <button
                type="button"
                className="boton-primario"
                style={{ fontSize: "13px", padding: "6px 12px" }}
                onClick={() => {
                  cerrar();
                  alOrganizar();
                }}
              >
                + Crear o cargar cursos de ejemplo
              </button>
            )}
          </div>
        )}
        <label>
          Título de la evaluación
          <input
            required
            maxLength={255}
            value={titulo}
            onChange={(evento) => cambiarTitulo(evento.target.value)}
          />
        </label>
        <label>
          Puntaje máximo
          <input
            type="number"
            required
            min="1"
            max="100"
            step="0.01"
            value={maximo}
            onChange={(evento) => cambiarMaximo(evento.target.value)}
          />
        </label>
        <label>
          Indicaciones para la corrección
          <textarea
            rows={4}
            maxLength={10000}
            value={indicaciones}
            onChange={(evento) => cambiarIndicaciones(evento.target.value)}
            placeholder="Puntajes parciales, unidades, criterios de corrección…"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="boton-primario" disabled={ocupado || !cursos.length}>
          {ocupado ? "Creando…" : "Crear evaluación"}
        </button>
      </form>
    </Ventana>
  );
}
