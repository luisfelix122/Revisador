import { useState as usarEstado, useEffect as usarEfecto, useRef as usarReferencia } from "react";
import { TiempoRestante } from "./TiempoRestante";
import {
  Link as EnlaceIcon,
  Copy as Copiar,
  Check as CheckIcon,
  Clock as Reloj,
  Lock as Candado,
  Unlock as Desbloquear,
  RefreshCw as Recargar,
  Eye as Ver,
  Send as Enviar,
  RotateCw as Girar,
  AlertCircle as Alerta,
  Share2 as Compartir,
  CheckSquare as CasillaMarcada,
  Square as CasillaVacia,
  Users as Usuarios
} from "lucide-react";
import type { EvaluacionDetalle, Examen, HistorialEntrega, ServicioBiblioteca } from "../servicios/biblioteca";

interface Propiedades {
  evaluacion: EvaluacionDetalle;
  servicio: ServicioBiblioteca;
  apiVerificada: boolean;
  alActualizar: () => Promise<void>;
  alRevisarExamen: (examen: Examen) => void;
  alCalificarLote: (modo: "pendientes" | "todos" | "seleccionados", seleccionados?: string[]) => Promise<void>;
  ocupado: boolean;
  corriendo: boolean;
}

export function RecepcionAlumnos({
  evaluacion,
  servicio,
  apiVerificada,
  alActualizar,
  alRevisarExamen,
  alCalificarLote,
  ocupado,
  corriendo,
}: Propiedades) {
  const [copiado, cambiarCopiado] = usarEstado(false);
  const [copiadoMensaje, cambiarCopiadoMensaje] = usarEstado(false);
  const [minutosCierre, cambiarMinutosCierre] = usarEstado("30");
  const [cupoEstudiantes, cambiarCupoEstudiantes] = usarEstado(
    evaluacion.cantidad_estudiantes_esperados ? String(evaluacion.cantidad_estudiantes_esperados) : ""
  );
  const [seleccionados, cambiarSeleccionados] = usarEstado<string[]>([]);
  const [accionEnCurso, cambiarAccionEnCurso] = usarEstado(false);
  const [errorLocal, mostrarErrorLocal] = usarEstado("");
  const [mensajeExito, avisarExito] = usarEstado("");

  usarEfecto(() => {
    cambiarCupoEstudiantes(
      evaluacion.cantidad_estudiantes_esperados ? String(evaluacion.cantidad_estudiantes_esperados) : ""
    );
  }, [evaluacion.cantidad_estudiantes_esperados]);

  const urlEntrega = typeof window !== "undefined"
    ? `${window.location.origin}/?entrega=${evaluacion.token_recepcion || evaluacion.id}`
    : "";

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(urlEntrega);
      cambiarCopiado(true);
      setTimeout(() => cambiarCopiado(false), 2500);
    } catch {
      mostrarErrorLocal("No se pudo copiar el enlace al portapapeles.");
    }
  };

  const copiarMensajeWhatsApp = async () => {
    const mensaje = `Estimados estudiantes, ya pueden ingresar al siguiente enlace para subir su examen de ${evaluacion.titulo} (${evaluacion.cursos?.nombre || "Curso"}):\n\n${urlEntrega}\n\nIngresen con su código universitario y foto nítida.`;
    try {
      await navigator.clipboard.writeText(mensaje);
      cambiarCopiadoMensaje(true);
      setTimeout(() => cambiarCopiadoMensaje(false), 2500);
    } catch {
      mostrarErrorLocal("No se pudo copiar el mensaje para WhatsApp.");
    }
  };

  const alternarApertura = async (abrir: boolean) => {
    cambiarAccionEnCurso(true);
    mostrarErrorLocal("");
    avisarExito("");
    try {
      const tiempo = abrir && Number(minutosCierre) > 0 ? Number(minutosCierre) : null;
      await servicio.configurarRecepcion(
        evaluacion.id,
        abrir,
        tiempo,
        evaluacion.permitir_reenvios_global || false,
        evaluacion.cantidad_estudiantes_esperados ?? null
      );
      await alActualizar();
      avisarExito(abrir ? "Recepción de entregas abierta con éxito." : "Recepción de entregas cerrada.");
    } catch (err) {
      mostrarErrorLocal(err instanceof Error ? err.message : "No se pudo actualizar el estado de recepción.");
    } finally {
      cambiarAccionEnCurso(false);
    }
  };

  const alternarReenvioGlobal = async () => {
    cambiarAccionEnCurso(true);
    mostrarErrorLocal("");
    try {
      const nuevoEstado = !evaluacion.permitir_reenvios_global;
      await servicio.configurarRecepcion(
        evaluacion.id,
        evaluacion.recepcion_abierta || false,
        evaluacion.tiempo_limite_minutos || null,
        nuevoEstado,
        evaluacion.cantidad_estudiantes_esperados ?? null
      );
      await alActualizar();
      avisarExito(nuevoEstado ? "Reenvío general habilitado para toda la clase." : "Reenvío general deshabilitado.");
    } catch (err) {
      mostrarErrorLocal(err instanceof Error ? err.message : "Error al configurar reenvíos globales.");
    } finally {
      cambiarAccionEnCurso(false);
    }
  };

  const guardarCupo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    cambiarAccionEnCurso(true);
    mostrarErrorLocal("");
    avisarExito("");
    try {
      const valor = cupoEstudiantes.trim() === "" ? null : parseInt(cupoEstudiantes, 10);
      if (valor !== null && (isNaN(valor) || valor <= 0)) {
        mostrarErrorLocal("El aforo de alumnos debe ser un número entero positivo.");
        cambiarAccionEnCurso(false);
        return;
      }
      await servicio.configurarRecepcion(
        evaluacion.id,
        evaluacion.recepcion_abierta || false,
        evaluacion.tiempo_limite_minutos || null,
        evaluacion.permitir_reenvios_global || false,
        valor
      );
      await alActualizar();
      avisarExito(
        valor
          ? `Aforo fijado en ${valor} alumnos presentes en el aula.`
          : "Aforo sin límite establecido (recepción libre)."
      );
    } catch (err) {
      mostrarErrorLocal(err instanceof Error ? err.message : "Error al guardar el aforo de estudiantes.");
    } finally {
      cambiarAccionEnCurso(false);
    }
  };

  const alternarReenvioIndividual = async (examenId: string, permitirActual: boolean) => {
    cambiarAccionEnCurso(true);
    mostrarErrorLocal("");
    try {
      await servicio.permitirReenvioAlumno(evaluacion.id, examenId, !permitirActual);
      await alActualizar();
      avisarExito(!permitirActual ? "Permiso de reenvío concedido al estudiante." : "Permiso de reenvío revocado.");
    } catch (err) {
      mostrarErrorLocal(err instanceof Error ? err.message : "Error al modificar permiso individual.");
    } finally {
      cambiarAccionEnCurso(false);
    }
  };

  const alternarSeleccion = (id: string) => {
    cambiarSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const alternarTodos = () => {
    if (seleccionados.length === evaluacion.examenes_estudiantes.length) {
      cambiarSeleccionados([]);
    } else {
      cambiarSeleccionados(evaluacion.examenes_estudiantes.map((e) => e.id));
    }
  };

  const totalEntregados = evaluacion.examenes_estudiantes.length;
  const totalCompletados = evaluacion.examenes_estudiantes.filter((e) => e.estado_revision === "completado").length;
  const totalPendientes = totalEntregados - totalCompletados;

  return (
    <section aria-label="Recepción autónoma de alumnos" style={{ marginTop: "16px" }}>
      {/* Tarjeta de Enlace Público y QR */}
      <div style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#202124", margin: "0 0 4px 0" }}>
              Enlace de recepción para estudiantes
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#5f6368", margin: 0 }}>
              Comparte este enlace con tus alumnos para que suban sus exámenes desde sus teléfonos sin registro.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="boton-contorno"
              onClick={() => void copiarEnlace()}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
            >
              {copiado ? <CheckIcon size={15} color="#137333" /> : <Copiar size={15} />}
              {copiado ? "Enlace copiado" : "Copiar enlace"}
            </button>

            <button
              type="button"
              className="boton-contorno"
              onClick={() => void copiarMensajeWhatsApp()}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "#137333", borderColor: "#ceead6" }}
            >
              {copiadoMensaje ? <CheckIcon size={15} color="#137333" /> : <Compartir size={15} />}
              {copiadoMensaje ? "Mensaje copiado" : "Copiar p/ WhatsApp"}
            </button>
          </div>
        </div>

        <div style={{ background: "#f8f9fa", border: "1px solid #dadce0", borderRadius: "6px", padding: "8px 12px", fontSize: "0.82rem", color: "#3c4043", wordBreak: "break-all", display: "flex", alignItems: "center", gap: "8px" }}>
          <EnlaceIcon size={15} color="#1a73e8" style={{ flexShrink: 0 }} />
          <span>{urlEntrega}</span>
        </div>
      </div>

      {/* Barra de Control de Tiempo y Permisos */}
      <div style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#202124", margin: "0 0 12px 0" }}>
          Control de aula y límites de entrega
        </h3>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {evaluacion.recepcion_abierta ? (
              <button
                type="button"
                className="boton-contorno"
                disabled={accionEnCurso || ocupado}
                onClick={() => void alternarApertura(false)}
                style={{ color: "#d93025", borderColor: "#fce8e6", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Candado size={15} /> Cerrar entregas ahora
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="boton-primario"
                  disabled={accionEnCurso || ocupado}
                  onClick={() => void alternarApertura(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Desbloquear size={15} /> Reabrir entregas
                </button>
                <label style={{ fontSize: "0.82rem", color: "#5f6368", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Por (min):
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={minutosCierre}
                    onChange={(e) => cambiarMinutosCierre(e.target.value)}
                    style={{ width: "60px", padding: "4px 6px", borderRadius: "4px", border: "1px solid #dadce0" }}
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              className="boton-contorno"
              disabled={accionEnCurso || ocupado}
              onClick={() => void alternarReenvioGlobal()}
              style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Recargar size={14} />
              {evaluacion.permitir_reenvios_global
                ? "Bloquear reenvíos globales"
                : "Permitir reenvíos a toda la clase"}
            </button>
          </div>

          <div style={{ fontSize: "0.85rem", color: "#5f6368" }}>
            Estado:{" "}
            {evaluacion.recepcion_abierta ? (
              <strong style={{ color: "#137333" }}>Abierto para entregas</strong>
            ) : (
              <strong style={{ color: "#d93025" }}>Cerrado (Nadie puede subir)</strong>
            )}
          </div>
        </div>

        {evaluacion.recepcion_abierta && <TiempoRestante fechaCierre={evaluacion.fecha_cierre_programada} />}
        {/* Control de Aforo / Alumnos presentes en aula */}
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f1f3f4" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <strong style={{ fontSize: "0.88rem", color: "#202124", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Usuarios size={16} color="#1a73e8" /> Aforo de alumnos en aula:
              </strong>
              <p style={{ fontSize: "0.8rem", color: "#5f6368", margin: "2px 0 0 0" }}>
                Fija la cantidad de estudiantes que rinden la prueba para evitar que alumnos fuera del aula suban exámenes.
              </p>
            </div>

            <form
              onSubmit={(e) => void guardarCupo(e)}
              style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
            >
              <label style={{ fontSize: "0.82rem", color: "#3c4043", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                Alumnos esperados:
                <input
                  type="number"
                  min="1"
                  max="1000"
                  aria-label="Cantidad de alumnos en aula"
                  placeholder="Sin límite"
                  value={cupoEstudiantes}
                  onChange={(e) => cambiarCupoEstudiantes(e.target.value)}
                  style={{ width: "95px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #dadce0", fontSize: "0.85rem" }}
                />
              </label>

              <button
                type="submit"
                className="boton-contorno"
                disabled={accionEnCurso || ocupado}
                style={{ fontSize: "0.82rem", padding: "4px 10px" }}
              >
                Guardar aforo
              </button>
            </form>
          </div>

          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "12px", fontSize: "0.82rem" }}>
            {evaluacion.cantidad_estudiantes_esperados ? (
              <>
                <span style={{ color: "#3c4043" }}>
                  Entregas recibidas: <strong>{totalEntregados}</strong> de <strong>{evaluacion.cantidad_estudiantes_esperados}</strong> alumnos presentes
                </span>
                {totalEntregados >= evaluacion.cantidad_estudiantes_esperados ? (
                  <span style={{ color: "#b06000", background: "#fef7e0", padding: "2px 8px", borderRadius: "10px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Alerta size={13} /> Aforo completado ({totalEntregados}/{evaluacion.cantidad_estudiantes_esperados}) - Nuevos accesos bloqueados
                  </span>
                ) : (
                  <span style={{ color: "#137333", background: "#e6f4ea", padding: "2px 8px", borderRadius: "10px", fontWeight: 500 }}>
                    Vacantes disponibles: {evaluacion.cantidad_estudiantes_esperados - totalEntregados}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: "#5f6368", fontStyle: "italic" }}>
                Sin límite de aforo fijado (cualquier alumno con el enlace puede entregar).
              </span>
            )}
          </div>
        </div>

        {errorLocal && (
          <p role="alert" className="error" style={{ marginTop: "10px", marginBottom: 0 }}>
            {errorLocal}
          </p>
        )}
        {mensajeExito && (
          <p role="status" className="exito" style={{ marginTop: "10px", marginBottom: 0 }}>
            {mensajeExito}
          </p>
        )}
      </div>

      {/* Resumen y Acciones de Calificación Flexible */}
      <div style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "16px", fontSize: "0.88rem", color: "#3c4043" }}>
            <span><strong>Total entregados:</strong> {totalEntregados}</span>
            <span><strong>Calificados:</strong> {totalCompletados}</span>
            <span><strong>Pendientes de nota:</strong> <span style={{ color: totalPendientes > 0 ? "#1a73e8" : "inherit" }}>{totalPendientes}</span></span>
          </div>

          {/* Botones de calificación */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="boton-primario"
              disabled={!apiVerificada || ocupado || corriendo || totalPendientes === 0}
              onClick={() => void alCalificarLote("pendientes")}
              title="Califica únicamente los exámenes que aún no tienen nota"
              style={{ fontSize: "0.85rem" }}
            >
              Revisar solo pendientes ({totalPendientes})
            </button>

            <button
              type="button"
              className="boton-contorno"
              disabled={!apiVerificada || ocupado || corriendo || totalEntregados === 0}
              onClick={() => void alCalificarLote("todos")}
              title="Reevalúa el lote completo de exámenes"
              style={{ fontSize: "0.85rem" }}
            >
              Revisar a todos ({totalEntregados})
            </button>

            <button
              type="button"
              className="boton-contorno"
              disabled={!apiVerificada || ocupado || corriendo || seleccionados.length === 0}
              onClick={() => void alCalificarLote("seleccionados", seleccionados)}
              title="Califica solo a los estudiantes con casilla marcada"
              style={{ fontSize: "0.85rem" }}
            >
              Revisar seleccionados ({seleccionados.length})
            </button>
          </div>
        </div>

        {/* Tabla de Entregas de Alumnos */}
        {totalEntregados === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#5f6368" }}>
            <Reloj size={32} style={{ margin: "0 auto 8px auto", opacity: 0.6 }} />
            <p style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: 500, color: "#202124" }}>
              Esperando entregas de los estudiantes
            </p>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              Comparte el enlace o código QR. Los exámenes aparecerán aquí automáticamente en tiempo real.
            </p>
          </div>
        ) : (
          <div className="tabla-adaptable">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <button
                      type="button"
                      className="boton-icono"
                      onClick={alternarTodos}
                      title="Seleccionar o deseleccionar todos"
                      style={{ padding: 0 }}
                    >
                      {seleccionados.length === totalEntregados ? (
                        <CasillaMarcada size={18} color="#1a73e8" />
                      ) : (
                        <CasillaVacia size={18} color="#5f6368" />
                      )}
                    </button>
                  </th>
                  <th>Estudiante</th>
                  <th>Código</th>
                  <th>Entregas</th>
                  <th>Reenvío</th>
                  <th>Nota</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {evaluacion.examenes_estudiantes.map((examen) => {
                  const estaSeleccionado = seleccionados.includes(examen.id);
                  const tienePermisoReenvio = Boolean(examen.permitir_reenvio || evaluacion.permitir_reenvios_global);
                  const entregasNum = examen.numero_entregas || 1;

                  return (
                    <tr key={examen.id}>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="boton-icono"
                          onClick={() => alternarSeleccion(examen.id)}
                          style={{ padding: 0 }}
                        >
                          {estaSeleccionado ? (
                            <CasillaMarcada size={18} color="#1a73e8" />
                          ) : (
                            <CasillaVacia size={18} color="#5f6368" />
                          )}
                        </button>
                      </td>
                      <td>
                        <strong>{examen.nombre_estudiante}</strong>
                      </td>
                      <td>
                        <code>{examen.codigo_estudiante}</code>
                      </td>
                      <td>
                        <span
                          style={{
                            background: entregasNum > 1 ? "#fef7e0" : "#f1f3f4",
                            color: entregasNum > 1 ? "#b06000" : "#3c4043",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                          }}
                        >
                          Entrega #{entregasNum}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="boton-texto"
                          disabled={accionEnCurso || ocupado}
                          onClick={() => void alternarReenvioIndividual(examen.id, Boolean(examen.permitir_reenvio))}
                          style={{
                            fontSize: "0.8rem",
                            color: tienePermisoReenvio ? "#137333" : "#5f6368",
                            fontWeight: tienePermisoReenvio ? 600 : "normal",
                          }}
                        >
                          {tienePermisoReenvio ? "Reenvío permitido" : "Permitir reenvío"}
                        </button>
                      </td>
                      <td>
                        {examen.estado_revision === "completado" ? (
                          <strong style={{ color: Number(examen.nota_final) >= 10.5 ? "#137333" : "#d93025" }}>
                            {Number(examen.nota_final).toFixed(2)}
                          </strong>
                        ) : examen.estado_revision === "procesando" ? (
                          <span style={{ color: "#1a73e8", fontSize: "0.82rem" }}>Calificando…</span>
                        ) : (
                          <span style={{ color: "#80868b", fontSize: "0.82rem" }}>Pendiente</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="boton-contorno"
                          onClick={() => alRevisarExamen(examen)}
                          style={{ padding: "4px 8px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Ver size={14} /> Revisar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
