import { useState as usarEstado, useEffect as usarEfecto } from "react";
import { TiempoRestante } from "./TiempoRestante";
import { SelectorPaginas, prepararFotos, type PaginaExamen } from "./SelectorPaginas";
import {
  Upload as Subir,
  CheckCircle2 as CheckExito,
  AlertCircle as Alerta,
  Clock as Reloj,
  Lock as Candado,
  RefreshCw as Recargar,
  ArrowLeft as Regresar,
  Users as Usuarios
} from "lucide-react";

interface InfoRecepcion {
  evaluacion_id: string;
  titulo: string;
  curso: string;
  facultad: string;
  escuela: string;
  anio: number;
  puntaje_maximo: number;
  recepcion_abierta: boolean;
  fecha_cierre?: string | null;
  permitir_reenvios_global?: boolean;
  cantidad_estudiantes_esperados?: number | null;
  total_entregados?: number;
  cupo_alcanzado?: boolean;
}

interface ComprobanteEntrega {
  examen_id: string;
  numero_entrega: number;
  codigo_estudiante: string;
  nombre_estudiante: string;
  entregado_en: string;
}

interface Propiedades {
  token: string;
  alVolver?: () => void;
}

export function PortalEntregaAlumno({ token, alVolver }: Propiedades) {
  const [info, cambiarInfo] = usarEstado<InfoRecepcion | null>(null);
  const [cargando, cambiarCargando] = usarEstado(true);
  const [enviando, cambiarEnviando] = usarEstado(false);
  const [error, mostrarError] = usarEstado("");
  const [nombre, cambiarNombre] = usarEstado("");
  const [codigo, cambiarCodigo] = usarEstado("");
  const [paginas, cambiarPaginas] = usarEstado<PaginaExamen[]>([]);
  const [comprobante, cambiarComprobante] = usarEstado<ComprobanteEntrega | null>(null);

  const cargarInfo = async () => {
    cambiarCargando(true);
    mostrarError("");
    try {
      const respuesta = await fetch(`/api/recepcion/${token}`);
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos?.detalle ?? datos?.detail ?? "No se pudo cargar la información de la evaluación.");
      }
      cambiarInfo(datos);
    } catch (err) {
      mostrarError(err instanceof Error ? err.message : "Error al consultar la evaluación.");
    } finally {
      cambiarCargando(false);
    }
  };

  usarEfecto(() => {
    void cargarInfo();
  }, [token]);

  const enviarEntrega = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!codigo.trim()) {
      mostrarError("Ingresa tu código universitario.");
      return;
    }
    if (!paginas.length) {
      mostrarError("Adjunta la foto o documento de tu examen.");
      return;
    }

    cambiarEnviando(true);
    mostrarError("");

    try {
      const esPdf = paginas.length === 1 && /\.pdf$/i.test(paginas[0].archivo.name);
      const formulario = esPdf ? new FormData() : await prepararFotos(paginas);
      formulario.append("nombre", nombre.trim() || "nada");
      formulario.append("codigo", codigo.trim());
      if (esPdf) formulario.append("archivo", paginas[0].archivo);
      const respuesta = await fetch(`/api/recepcion/${token}/${esPdf ? "entregar" : "entregar-fotos"}`, {
        method: "POST", body: formulario,
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos?.detalle ?? datos?.detail ?? "No se pudo procesar la entrega del examen.");
      }
      cambiarComprobante(datos);
    } catch (err) {
      mostrarError(err instanceof Error ? err.message : "Error al registrar la entrega.");
    } finally {
      cambiarEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", padding: "24px", textAlign: "center", background: "#ffffff", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
        <p style={{ color: "#5f6368", fontSize: "1rem" }}>Cargando información de la evaluación…</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", padding: "24px", background: "#ffffff", borderRadius: "8px", border: "1px solid #e0e0e0", textAlign: "center" }}>
        <div style={{ color: "#d93025", marginBottom: "12px", display: "flex", justifyContent: "center" }}>
          <Alerta size={40} />
        </div>
        <h2 style={{ fontSize: "1.25rem", color: "#202124", marginBottom: "8px" }}>Enlace de entrega no disponible</h2>
        <p style={{ color: "#5f6368", fontSize: "0.95rem", marginBottom: "20px" }}>{error || "El enlace no existe o la evaluación ya no se encuentra activa."}</p>
        <button type="button" className="boton-contorno" onClick={() => void cargarInfo()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: "650px", margin: "24px auto", padding: "16px", fontFamily: "Inter, system-ui, sans-serif" }}>
      {alVolver && (
        <button
          type="button"
          className="boton-texto"
          onClick={alVolver}
          style={{ marginBottom: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Regresar size={16} /> Volver a biblioteca
        </button>
      )}

      {/* Encabezado Académico Institucional (Jerarquía 3NF) */}
      <header style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "0.82rem", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
          {info.anio} · {info.facultad} · {info.escuela}
        </div>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 600, color: "#202124", margin: "0 0 6px 0" }}>
          {info.titulo}
        </h1>
        <div style={{ fontSize: "0.95rem", color: "#1a73e8", fontWeight: 500 }}>
          {info.curso} · Máximo {info.puntaje_maximo} puntos
        </div>

        {/* Estado de Recepción y Aforo */}
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f3f4", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {info.recepcion_abierta ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#137333", fontSize: "0.88rem", fontWeight: 500, background: "#e6f4ea", padding: "4px 10px", borderRadius: "16px" }}>
                <Reloj size={15} /> Recepción de entregas abierta
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#d93025", fontSize: "0.88rem", fontWeight: 500, background: "#fce8e6", padding: "4px 10px", borderRadius: "16px" }}>
                <Candado size={15} /> Recepción de entregas cerrada
              </span>
            )}

            {info.cantidad_estudiantes_esperados ? (
              <span style={{ fontSize: "0.82rem", color: "#5f6368", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Usuarios size={14} color="#1a73e8" />
                Aforo: <strong>{info.total_entregados ?? 0}</strong> / <strong>{info.cantidad_estudiantes_esperados}</strong> alumnos
              </span>
            ) : null}
          </div>

          <button
            type="button"
            className="boton-texto"
            onClick={() => void cargarInfo()}
            style={{ fontSize: "0.82rem", color: "#5f6368", display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <Recargar size={13} /> Actualizar estado
          </button>
        </div>
        {info.recepcion_abierta && <TiempoRestante fechaCierre={info.fecha_cierre} />}
      </header>

      {/* Comprobante de Entrega Exitosa */}
      {comprobante ? (
        <section style={{ background: "#ffffff", border: "1px solid #ceead6", borderRadius: "8px", padding: "24px", textAlign: "center" }}>
          <div style={{ color: "#137333", display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <CheckExito size={48} />
          </div>
          <h2 style={{ fontSize: "1.25rem", color: "#137333", margin: "0 0 8px 0" }}>
            Examen recibido correctamente
          </h2>
          <p style={{ color: "#3c4043", fontSize: "0.95rem", marginBottom: "16px" }}>
            Tu entrega ha sido registrada en el sistema del curso y se encuentra lista para la revisión docente.
          </p>

          <div style={{ background: "#f8f9fa", border: "1px solid #e8eaed", borderRadius: "6px", padding: "14px", textAlign: "left", fontSize: "0.88rem", color: "#202124", marginBottom: "20px" }}>
            <div style={{ marginBottom: "6px" }}><strong>Estudiante:</strong> {comprobante.nombre_estudiante}</div>
            <div style={{ marginBottom: "6px" }}><strong>Código Universitario:</strong> {comprobante.codigo_estudiante}</div>
            <div style={{ marginBottom: "6px" }}>
              <strong>Número de Entrega:</strong>{" "}
              <span style={{ background: "#1a73e8", color: "#ffffff", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: 600 }}>
                Entrega #{comprobante.numero_entrega}
              </span>
            </div>
            <div><strong>Fecha y hora registrada:</strong> {new Date(comprobante.entregado_en).toLocaleString("es-PE")}</div>
          </div>

          <p style={{ fontSize: "0.82rem", color: "#5f6368" }}>
            Guarda este comprobante. El docente revisará las respuestas y los resultados se publicarán al finalizar la calificación.
          </p>
        </section>
      ) : !info.recepcion_abierta ? (
        <section style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "32px 20px", textAlign: "center" }}>
          <div style={{ color: "#80868b", display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <Candado size={40} />
          </div>
          <h2 style={{ fontSize: "1.15rem", color: "#202124", marginBottom: "8px" }}>Plazo de entrega finalizado</h2>
          <p style={{ color: "#5f6368", fontSize: "0.92rem", margin: 0 }}>
            La recepción de exámenes para esta prueba se encuentra cerrada. Si tuviste un inconveniente justificado en el aula, consulta directamente con tu docente para que autorice una reapertura o reenvío.
          </p>
        </section>
      ) : (
        /* Formulario de Entrega */
        <form onSubmit={enviarEntrega} style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "20px" }}>
          <h2 style={{ fontSize: "1.1rem", color: "#202124", margin: "0 0 16px 0", fontWeight: 600 }}>
            Entrega de examen del estudiante
          </h2>

          {info.cupo_alcanzado && (
            <div
              role="alert"
              style={{
                background: "#fef7e0",
                border: "1px solid #feefc3",
                borderRadius: "6px",
                padding: "10px 12px",
                color: "#b06000",
                fontSize: "0.88rem",
                marginBottom: "16px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <Alerta size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Aforo completado:</strong> Se ha alcanzado el límite de estudiantes esperados ({info.cantidad_estudiantes_esperados} alumnos). Si estás en el aula y aún no entregaste, consulta con tu docente para que amplíe el aforo.
              </div>
            </div>
          )}

          <label style={{ display: "block", marginBottom: "14px", fontSize: "0.88rem", fontWeight: 500, color: "#202124" }}>
            Código universitario (Obligatorio)
            <input
              type="text"
              required
              disabled={enviando}
              value={codigo}
              onChange={(e) => cambiarCodigo(e.target.value)}
              placeholder="Ej. 20261004"
              style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #dadce0", fontSize: "0.95rem", boxSizing: "border-box" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "16px", fontSize: "0.88rem", fontWeight: 500, color: "#202124" }}>
            Apellidos y Nombres
            <input
              type="text"
              disabled={enviando}
              value={nombre}
              onChange={(e) => cambiarNombre(e.target.value)}
              placeholder="Ej. Ramos García, Carlos"
              style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #dadce0", fontSize: "0.95rem", boxSizing: "border-box" }}
            />
          </label>

          <div style={{ marginBottom: "16px" }}>
            <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 500, marginBottom: "8px" }}>Páginas de tu examen</span>
            <SelectorPaginas paginas={paginas} alCambiar={cambiarPaginas} deshabilitado={enviando} permitirPdf />
          </div>

          {error && (
            <div style={{ background: "#fce8e6", border: "1px solid #fad2cf", borderRadius: "6px", padding: "10px 12px", color: "#d93025", fontSize: "0.88rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Alerta size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="boton-primario"
            disabled={enviando || !paginas.length || !codigo.trim()}
            style={{ width: "100%", padding: "12px", fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Subir size={18} />
            {enviando ? "Enviando examen…" : "Confirmar y entregar examen"}
          </button>
        </form>
      )}
    </main>
  );
}
