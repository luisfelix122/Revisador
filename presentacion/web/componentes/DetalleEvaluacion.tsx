import {
  useState as usarEstado,
  useEffect as usarEfecto,
  useCallback as usarCallback,
  useRef as usarReferencia,
} from "react";
import {
  ArrowLeft as Regresar,
  Upload as Subir,
  Download as Descargar,
  Check as Check,
} from "lucide-react";
import {
  ServicioBiblioteca,
  type EvaluacionDetalle,
  type Pregunta,
  type Examen,
  type PreguntaResultado,
} from "../servicios/biblioteca";
import { leerCredenciales } from "../servicios/credenciales";
import { Ventana } from "./Ventana";

interface Preparacion {
  examenes: number;
  huella: string;
}
interface Propiedades {
  identificador: string;
  servicio: ServicioBiblioteca;
  apiVerificada: boolean;
  alVolver: () => void;
}
const mensaje = (problema: unknown) =>
  problema instanceof Error
    ? problema.message
    : "No se pudo completar. Inténtalo otra vez.";
const respuestaAusente = (respuesta: string) =>
  ["", "nada"].includes(respuesta.trim().toLocaleLowerCase("es"));

export function DetalleEvaluacion({
  identificador,
  servicio,
  apiVerificada,
  alVolver,
}: Propiedades) {
  const [evaluacion, cambiarEvaluacion] = usarEstado<EvaluacionDetalle | null>(
      null,
    ),
    [rubrica, cambiarRubrica] = usarEstado<Pregunta[]>([]),
    [guardada, marcarGuardada] = usarEstado(false),
    [ocupado, ocupar] = usarEstado(false),
    [corriendo, correr] = usarEstado(false),
    [error, mostrarError] = usarEstado(""),
    [aviso, avisar] = usarEstado(""),
    [estimacion, cambiarEstimacion] = usarEstado<Preparacion | null>(null),
    [consentimiento, consentir] = usarEstado(false),
    [consentimientoAnalisis, consentirAnalisis] = usarEstado(false),
    [busqueda, buscar] = usarEstado(""),
    [filtro, filtrar] = usarEstado("todos"),
    [revisando, revisar] = usarEstado<Examen | null>(null);
  const detener = usarReferencia(false);
  const configuracionEstimada = usarReferencia<{proveedor: string; clave_api: string; modelo: string} | null>(null);
  const cargar = usarCallback(async () => {
    const datos = await servicio.evaluacion(identificador);
    cambiarEvaluacion({
      ...datos,
      criterios_preguntas: datos.criterios_preguntas || [],
      soluciones_profesor: Array.isArray(datos.soluciones_profesor)
        ? datos.soluciones_profesor
        : datos.soluciones_profesor ? [datos.soluciones_profesor] : [],
      materiales_apoyo: datos.materiales_apoyo || [],
      examenes_estudiantes: (datos.examenes_estudiantes || []).map((examen) => ({
        ...examen,
        detalles_preguntas: examen.detalles_preguntas || [],
      })),
    });
    cambiarRubrica(
      [...(datos.criterios_preguntas || [])].sort(
        (a, b) => a.numero_pregunta - b.numero_pregunta,
      ),
    );
    marcarGuardada((datos.criterios_preguntas || []).length > 0);
  }, [identificador, servicio]);
  usarEfecto(() => {
    void cargar().catch((problema) => mostrarError(mensaje(problema)));
    return () => {
      detener.current = true;
    };
  }, [cargar]);
  const hayExamenEnProceso = evaluacion?.examenes_estudiantes.some(
    (examen) => examen.estado_revision === "procesando",
  ) ?? false;
  usarEfecto(() => {
    if (!hayExamenEnProceso || corriendo) return;
    const intervalo = window.setInterval(() => {
      void cargar().catch((problema) => mostrarError(mensaje(problema)));
    }, 15000);
    return () => window.clearInterval(intervalo);
  }, [cargar, corriendo, hayExamenEnProceso]);
  const cerrarRevision = usarCallback(() => revisar(null), []);
  const invalidar = () => {
    configuracionEstimada.current = null;
    cambiarEstimacion(null);
    consentir(false);
  };
  const credenciales = () => {
    const { credenciales } = leerCredenciales();
    if (!apiVerificada || !credenciales.clave || !credenciales.modelo)
      throw new Error(
        "Abre Configuración y comprueba la conexión de IA antes de continuar.",
      );
    return {
      proveedor: credenciales.proveedor,
      clave_api: credenciales.clave,
      modelo: credenciales.modelo,
    };
  };
  const subir = async (tipo: string, archivos: FileList | null) => {
    if (!archivos?.length) return;
    ocupar(true);
    mostrarError("");
    avisar("");
    invalidar();
    try {
      for (const archivo of Array.from(archivos)) {
        if (archivo.size > 3 * 1024 * 1024)
          throw new Error(`${archivo.name}: máximo 3 MB por archivo.`);
        await servicio.subir(identificador, tipo, archivo);
      }
      avisar("Archivos guardados en tu biblioteca privada.");
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      await cargar().catch(() => {});
      ocupar(false);
    }
  };
  const analizar = async () => {
    ocupar(true);
    mostrarError("");
    try {
      const datos = await servicio.datos<{ preguntas: Pregunta[] }>(
        `/evaluaciones/${identificador}/analizar-solucion`,
        {
          method: "POST",
          body: JSON.stringify({
            ...credenciales(),
            confirmar_costo: consentimientoAnalisis,
          }),
        },
      );
      cambiarRubrica(datos.preguntas);
      marcarGuardada(false);
      invalidar();
      avisar("Revisa los criterios y guarda la rúbrica antes de calificar.");
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      ocupar(false);
    }
  };
  const guardar = async () => {
    ocupar(true);
    mostrarError("");
    try {
      await servicio.datos(`/evaluaciones/${identificador}/rubrica`, {
        method: "PUT",
        body: JSON.stringify({ preguntas: rubrica }),
      });
      await cargar();
      invalidar();
      avisar("Rúbrica confirmada.");
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      ocupar(false);
    }
  };
  const preparar = async () => {
    ocupar(true);
    mostrarError("");
    invalidar();
    try {
      const configuracion = credenciales();
      const resultado = await servicio.datos<Preparacion>(
        `/evaluaciones/${identificador}/preparar`, { method: "POST" },
      );
      configuracionEstimada.current = configuracion;
      cambiarEstimacion(resultado);
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      ocupar(false);
    }
  };
  const calificar = async () => {
    if (!estimacion || !consentimiento || !evaluacion) return;
    let configuracion;
    try {
      configuracion = credenciales();
    } catch (problema) {
      mostrarError(mensaje(problema));
      return;
    }
    const anterior = configuracionEstimada.current;
    if (!anterior || anterior.proveedor !== configuracion.proveedor || anterior.modelo !== configuracion.modelo || anterior.clave_api !== configuracion.clave_api) {
      invalidar();
      mostrarError("La configuración de IA cambió. Vuelve a preparar la calificación.");
      return;
    }
    const parametros = {
      ...configuracion,
      confirmar_costo: true,
      huella: estimacion.huella,
    };
    const pendientes = evaluacion.examenes_estudiantes.filter(
      (e) => e.estado_revision !== "completado",
    );
    let indice = 0;
    const fallos: string[] = [];
    detener.current = false;
    correr(true);
    mostrarError("");
    avisar(
      "Procesando. Puedes detener el envío de nuevos exámenes; los que ya están en curso terminarán.",
    );
    const trabajador = async () => {
      while (!detener.current && indice < pendientes.length) {
        const examen = pendientes[indice++];
        try {
          await servicio.datos(
            `/evaluaciones/${identificador}/calificar/${examen.id}`,
            { method: "POST", body: JSON.stringify(parametros) },
          );
        } catch (problema) {
          fallos.push(mensaje(problema));
        }
        await cargar().catch(() => {});
      }
    };
    await Promise.all([trabajador(), trabajador()]);
    correr(false);
    consentir(false);
    cambiarEstimacion(null);
    if (fallos.length)
      mostrarError(
        `${fallos.length} examen(es) no completados. ${fallos[0]} Los completados se conservaron.`,
      );
    avisar(
      detener.current
        ? "Lote detenido. Los resultados guardados se conservan."
        : "Lote terminado. Revisa las notas antes de utilizarlas.",
    );
    await cargar().catch(() => {});
  };
  const descargar = async () => {
    ocupar(true);
    mostrarError("");
    try {
      const respuesta = await servicio.solicitar(
        `/evaluaciones/${identificador}/reporte`,
      );
      const enlace = document.createElement("a"),
        url = URL.createObjectURL(await respuesta.blob());
      enlace.href = url;
      enlace.download = `Acta_${evaluacion?.cursos.nombre}_${evaluacion?.titulo}.xlsx`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      ocupar(false);
    }
  };
  if (!evaluacion)
    return (
      <section className="detalle">
        <button className="boton-texto" onClick={alVolver}>
          <Regresar size={17} />
          Volver a la biblioteca
        </button>
        {error ? (
          <p className="error" role="alert">
            {error}
            <button onClick={() => {
              mostrarError("");
              void cargar().catch((problema) => mostrarError(mensaje(problema)));
            }}>Reintentar</button>
          </p>
        ) : (
          <p role="status">Cargando evaluación…</p>
        )}
      </section>
    );
  const bloqueada = evaluacion.examenes_estudiantes.some((e) =>
      ["procesando", "completado"].includes(e.estado_revision),
    ),
    completados = evaluacion.examenes_estudiantes.filter(
      (e) => e.estado_revision === "completado",
    ),
    totalRubrica = rubrica.reduce(
      (suma, p) => suma + Number(p.puntaje_maximo),
      0,
    ),
    resultados = completados.filter(
      (e) =>
        (e.nombre_estudiante + " " + e.codigo_estudiante)
          .toLocaleLowerCase("es")
          .includes(busqueda.toLocaleLowerCase("es")) &&
        (filtro === "todos" ||
          (filtro === "aprobados" && e.nota_final >= 10.5) ||
          (filtro === "desaprobados" && e.nota_final < 10.5) ||
          (filtro === "nada" && e.nombre_estudiante === "nada")),
    );
  return (
    <section className="detalle">
      <button className="boton-texto" onClick={alVolver} disabled={corriendo}>
        <Regresar size={17} />
        Volver a la biblioteca
      </button>
      <div className="cabecera-detalle">
        <div>
          <h1>{evaluacion.titulo}</h1>
          <p>
            {evaluacion.cursos.nombre} · Máximo{" "}
            {evaluacion.puntaje_total_maximo} puntos
          </p>
        </div>
        <span className="estado-evaluacion">
          {evaluacion.estado === "borrador" ? "En preparación" : "Calificada"}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="exito" role="status">
          {aviso}
        </p>
      )}
      <section className="seccion-evaluacion" aria-labelledby="titulo-archivos">
        <h2 id="titulo-archivos">Solución, materiales y exámenes</h2>
        <p className="descripcion">
          Hasta 3 MB por archivo y 20 páginas por documento. Cada imagen de
          estudiante corresponde a un examen. La subida no inicia la
          calificación.
        </p>
        <div className="cargas-archivos">
          <label>
            Solución oficial
            <input
              aria-label="Solución oficial"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
              disabled={
                ocupado ||
                corriendo ||
                bloqueada ||
                evaluacion.soluciones_profesor.length > 0
              }
              onChange={(evento) => {
                void subir("solucion", evento.target.files);
                evento.target.value = "";
              }}
            />
            <span>
              {evaluacion.soluciones_profesor.length
                ? "Solución oficial guardada"
                : "Obligatoria · imagen, PDF o Word"}
            </span>
          </label>
          <label>
            Materiales de apoyo
            <input
              aria-label="Materiales de apoyo"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
              disabled={ocupado || corriendo || bloqueada}
              onChange={(evento) => {
                void subir("material", evento.target.files);
                evento.target.value = "";
              }}
            />
            <span>
              {evaluacion.materiales_apoyo.length}/5 materiales guardados
            </span>
          </label>
          <label>
            Exámenes de estudiantes
            <input
              aria-label="Exámenes de estudiantes"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp"
              disabled={ocupado || corriendo || bloqueada}
              onChange={(evento) => {
                void subir("examen", evento.target.files);
                evento.target.value = "";
              }}
            />
            <span>
              {evaluacion.examenes_estudiantes.length}/100 exámenes guardados
            </span>
          </label>
        </div>
        {(evaluacion.materiales_apoyo || []).length > 0 && (
          <ul className="materiales">
            {(evaluacion.materiales_apoyo || []).map((m) => (
              <li key={m.id}>
                {m.nombre_archivo} · {m.cantidad_paginas} página(s)
              </li>
            ))}
          </ul>
        )}
        {evaluacion.indicaciones_profesor && (
          <details>
            <summary>Indicaciones del profesor</summary>
            <p className="indicaciones">{evaluacion.indicaciones_profesor}</p>
          </details>
        )}
      </section>
      <section className="seccion-evaluacion">
        <h2>Criterios de corrección</h2>
        <p className="descripcion">
          Extrae los criterios de la solución o escríbelos manualmente. Revisa
          las respuestas esperadas y asegúrate de que sumen{" "}
          {evaluacion.puntaje_total_maximo} puntos.
        </p>
        {!bloqueada && (
          <>
            <label className="casilla">
              <input
                type="checkbox"
                checked={consentimientoAnalisis}
                onChange={(evento) => consentirAnalisis(evento.target.checked)}
              />
              Autorizo una llamada de IA para analizar la solución; puede
              consumir saldo.
            </label>
            <button
              className="boton-contorno"
              disabled={
                ocupado ||
                corriendo ||
                !apiVerificada ||
                !consentimientoAnalisis ||
                !evaluacion.soluciones_profesor.length
              }
              onClick={() => void analizar()}
            >
              Analizar solución con IA
            </button>
            {!apiVerificada && (
              <p className="ayuda-campo">
                Comprueba tu API desde el engranaje para habilitar el análisis y
                la calificación.
              </p>
            )}
          </>
        )}
        <div className="tabla-adaptable">
          <table className="tabla-criterios">
            <thead>
              <tr>
                <th>Pregunta</th>
                <th>Máximo</th>
                <th>Respuesta esperada / criterio</th>
              </tr>
            </thead>
            <tbody>
              {rubrica.map((pregunta, indice) => (
                <tr key={indice}>
                  <td>P{pregunta.numero_pregunta}</td>
                  <td>
                    <input
                      aria-label={`Máximo P${pregunta.numero_pregunta}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      max="100"
                      disabled={bloqueada || ocupado || corriendo}
                      value={pregunta.puntaje_maximo}
                      onChange={(evento) => {
                        cambiarRubrica(
                          rubrica.map((p, i) =>
                            i === indice
                              ? {
                                  ...p,
                                  puntaje_maximo: Number(evento.target.value),
                                }
                              : p,
                          ),
                        );
                        marcarGuardada(false);
                        invalidar();
                      }}
                    />
                  </td>
                  <td>
                    <textarea
                      aria-label={`Criterio P${pregunta.numero_pregunta}`}
                      rows={2}
                      maxLength={10000}
                      disabled={bloqueada || ocupado || corriendo}
                      value={pregunta.respuesta_esperada}
                      onChange={(evento) => {
                        cambiarRubrica(
                          rubrica.map((p, i) =>
                            i === indice
                              ? {
                                  ...p,
                                  respuesta_esperada: evento.target.value,
                                }
                              : p,
                          ),
                        );
                        marcarGuardada(false);
                        invalidar();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="acciones-rubrica">
          {!bloqueada && (
            <>
              <button
                className="boton-texto"
                disabled={ocupado || corriendo || rubrica.length >= 100}
                onClick={() => {
                  cambiarRubrica([
                    ...rubrica,
                    {
                      numero_pregunta: Array.from({ length: 100 }, (_, i) => i + 1)
                        .find((numero) => !rubrica.some((p) => p.numero_pregunta === numero))!,
                      puntaje_maximo: 1,
                      respuesta_esperada: "",
                    },
                  ]);
                  marcarGuardada(false);
                  invalidar();
                }}
              >
                Añadir pregunta
              </button>
              {rubrica.length > 0 && (
                <button
                  className="boton-texto"
                  disabled={ocupado || corriendo}
                  onClick={() => {
                    cambiarRubrica(rubrica.slice(0, -1));
                    marcarGuardada(false);
                    invalidar();
                  }}
                >
                  Quitar última
                </button>
              )}
            </>
          )}
          <span>
            Total: {totalRubrica.toFixed(2)} / {evaluacion.puntaje_total_maximo}
          </span>
          {!bloqueada && (
            <button
              className="boton-primario"
              disabled={
                ocupado ||
                corriendo ||
                !rubrica.length ||
                Math.abs(totalRubrica - evaluacion.puntaje_total_maximo) >
                  0.001 ||
                rubrica.some((p) => !p.respuesta_esperada.trim())
              }
              onClick={() => void guardar()}
            >
              Guardar rúbrica
            </button>
          )}
          {guardada && (
            <span className="azul">
              <Check size={16} />
              Rúbrica guardada
            </span>
          )}
        </div>
      </section>
      <section className="seccion-evaluacion">
        <h2>Calificación de exámenes</h2>
        <p className="descripcion">
          Antes de continuar, comprueba tu API, adjunta la solución y los exámenes,
          y guarda la rúbrica. La calificación envía documentos al proveedor y puede consumir saldo.
        </p>
        <button
          className="boton-contorno"
          disabled={ocupado || corriendo || !guardada || !apiVerificada ||
            !evaluacion.soluciones_profesor.length ||
            evaluacion.examenes_estudiantes.length === completados.length}
          onClick={() => void preparar()}
        >
          Preparar calificación
        </button>
        {estimacion && (
          <div className="resultado-costo">
            <strong>{estimacion.examenes} {estimacion.examenes === 1 ? "examen pendiente" : "exámenes pendientes"}</strong>
            <p>Se enviarán la solución, los materiales, las indicaciones y las fotos al proveedor seleccionado. La llamada puede consumir saldo.</p>
            <label className="casilla">
              <input type="checkbox" checked={consentimiento} onChange={(evento) => consentir(evento.target.checked)} />
              Autorizo el envío de estos documentos a mi proveedor y confirmo que puedo tratar los datos de mis estudiantes.
            </label>
            <button className="boton-primario" disabled={!consentimiento || corriendo || ocupado} onClick={() => void calificar()}>
              Confirmar y calificar lote
            </button>
          </div>
        )}
        {corriendo && (
          <div className="progreso">
            <progress
              value={completados.length}
              max={evaluacion.examenes_estudiantes.length}
            />
            <span>
              {completados.length}/{evaluacion.examenes_estudiantes.length}{" "}
              completados
            </span>
            <button
              className="boton-contorno"
              onClick={() => {
                detener.current = true;
                avisar(
                  "Deteniendo nuevos envíos. Espera a que terminen los exámenes en curso.",
                );
              }}
            >
              Detener nuevos envíos
            </button>
          </div>
        )}
        {evaluacion.examenes_estudiantes.some(
          (e) => e.estado_revision === "procesando",
        ) &&
          !corriendo && (
            <p className="aviso">
              Hay un examen en proceso. El estado se actualiza automáticamente;
              si la conexión se interrumpió, podrás reintentarlo después de 8 minutos. Un
              reintento podría consumir saldo adicional.
            </p>
          )}
      </section>
      <section className="seccion-evaluacion">
        <div className="cabecera-detalle">
          <h2>Resultados y revisión docente</h2>
          <button
            className="boton-contorno"
            disabled={!completados.length || ocupado}
            onClick={() => void descargar()}
          >
            <Descargar size={16} />
            Descargar Excel (.xlsx)
          </button>
        </div>
        {completados.length ? (
          <>
            <dl className="resumen-notas">
              <div>
                <dt>Evaluados</dt>
                <dd>{completados.length}</dd>
              </div>
              <div>
                <dt>Promedio</dt>
                <dd>
                  {(
                    completados.reduce(
                      (suma, e) => suma + Number(e.nota_final),
                      0,
                    ) / completados.length
                  ).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt>Máxima / mínima</dt>
                <dd>
                  {Math.max(
                    ...completados.map((e) => Number(e.nota_final)),
                  ).toFixed(2)}{" "}
                  /{" "}
                  {Math.min(
                    ...completados.map((e) => Number(e.nota_final)),
                  ).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt>Aprobados (≥10,5)</dt>
                <dd>
                  {Math.round(
                    (completados.filter((e) => e.nota_final >= 10.5).length /
                      completados.length) *
                      100,
                  )}
                  %
                </dd>
              </div>
            </dl>
            <div className="filtros-notas">
              <input
                aria-label="Buscar estudiante"
                placeholder="Buscar por nombre o código"
                value={busqueda}
                onChange={(evento) => buscar(evento.target.value)}
              />
              <select
                aria-label="Filtrar resultados"
                value={filtro}
                onChange={(evento) => filtrar(evento.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="aprobados">Aprobados</option>
                <option value="desaprobados">Desaprobados</option>
                <option value="nada">Sin identificar</option>
              </select>
            </div>
            <p className="ayuda-campo">
              Las notas de IA requieren tu revisión. El Excel incluye también
              resultados todavía no revisados.
            </p>
            <div className="tabla-adaptable">
              <table>
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Código</th>
                    <th>Nota final</th>
                    <th>Observaciones</th>
                    <th>Revisión</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((examen) => (
                    <tr key={examen.id}>
                      <td>
                        <span
                          className={
                            examen.nombre_estudiante === "nada"
                              ? "chip-neutro"
                              : ""
                          }
                        >
                          {examen.nombre_estudiante}
                        </span>
                      </td>
                      <td>{examen.codigo_estudiante}</td>
                      <td
                        className={
                          examen.nota_final >= 10.5
                            ? "nota-aprobada"
                            : "nota-desaprobada"
                        }
                      >
                        {Number(examen.nota_final).toFixed(2)}
                      </td>
                      <td>{examen.observaciones_generales}</td>
                      <td>
                        <button
                          className="boton-texto"
                          onClick={() => revisar(examen)}
                        >
                          {examen.revisado_por_profesor
                            ? "Revisada · ver detalle"
                            : "Revisar preguntas"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resultados.length && (
              <p>No hay estudiantes que coincidan con el filtro.</p>
            )}
          </>
        ) : (
          <p className="descripcion">
            Aún no hay exámenes calificados. Los resultados aparecerán aquí
            conforme termine cada examen.
          </p>
        )}
      </section>
      {revisando && (
        <RevisionExamen
          examen={revisando}
          servicio={servicio}
          evaluacionId={identificador}
          cerrar={cerrarRevision}
          alGuardar={async () => {
            await cargar();
            revisar(null);
          }}
        />
      )}
    </section>
  );
}

function RevisionExamen({
  examen,
  servicio,
  evaluacionId,
  cerrar,
  alGuardar,
}: {
  examen: Examen;
  servicio: ServicioBiblioteca;
  evaluacionId: string;
  cerrar: () => void;
  alGuardar: () => Promise<void>;
}) {
  const [nombre, cambiarNombre] = usarEstado(examen.nombre_estudiante),
    [codigo, cambiarCodigo] = usarEstado(examen.codigo_estudiante),
    [preguntas, cambiarPreguntas] = usarEstado<PreguntaResultado[]>(
      examen.detalles_preguntas,
    ),
    [ocupado, ocupar] = usarEstado(false),
    [error, mostrarError] = usarEstado("");
  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    ocupar(true);
    try {
      await servicio.datos(
        `/evaluaciones/${evaluacionId}/revision/${examen.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            nombre_estudiante: nombre,
            codigo_estudiante: codigo,
            observaciones_generales: examen.observaciones_generales,
            preguntas: preguntas.map((p) => ({
              numero_pregunta: p.numero_pregunta,
              puntaje_obtenido: Number(p.puntaje_obtenido),
              puntaje_maximo: Number(p.puntaje_maximo),
              respuesta_detectada: p.respuesta_detectada,
              justificacion: p.justificacion,
            })),
          }),
        },
      );
      await alGuardar();
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      ocupar(false);
    }
  };
  return (
    <Ventana titulo="Revisión por pregunta" cerrar={cerrar}>
      <form className="contenido-ventana" onSubmit={guardar}>
        <label>
          Estudiante
          <input
            maxLength={255}
            value={nombre}
            onChange={(evento) => cambiarNombre(evento.target.value)}
          />
        </label>
        <label>
          Código
          <input
            maxLength={100}
            value={codigo}
            onChange={(evento) => cambiarCodigo(evento.target.value)}
          />
        </label>
        {preguntas.map((pregunta, indice) => (
          <fieldset key={pregunta.numero_pregunta}>
            <legend>
              Pregunta {pregunta.numero_pregunta} · máximo{" "}
              {pregunta.puntaje_maximo}
            </legend>
            <label>
              Respuesta detectada
              <textarea
                value={pregunta.respuesta_detectada}
                maxLength={10000}
                rows={3}
                onChange={(evento) => {
                  const respuesta = evento.target.value;
                  cambiarPreguntas(preguntas.map((p, i) => i === indice ? {
                    ...p,
                    respuesta_detectada: respuesta,
                    puntaje_obtenido: respuestaAusente(respuesta) ? 0 : p.puntaje_obtenido,
                  } : p));
                }}
              />
            </label>
            <label>
              Puntaje obtenido
              <input
                type="number"
                min="0"
                max={pregunta.puntaje_maximo}
                step="0.01"
                required
                disabled={respuestaAusente(pregunta.respuesta_detectada)}
                value={pregunta.puntaje_obtenido}
                onChange={(evento) =>
                  cambiarPreguntas(
                    preguntas.map((p, i) =>
                      i === indice
                        ? {
                            ...p,
                            puntaje_obtenido: Number(evento.target.value),
                          }
                        : p,
                    ),
                  )
                }
              />
            </label>
            {respuestaAusente(pregunta.respuesta_detectada) && (
              <p className="ayuda-campo">Las respuestas sin contestar reciben cero puntos.</p>
            )}
            <label>
              Justificación
              <textarea
                required
                maxLength={10000}
                rows={3}
                value={pregunta.justificacion}
                onChange={(evento) =>
                  cambiarPreguntas(
                    preguntas.map((p, i) =>
                      i === indice
                        ? { ...p, justificacion: evento.target.value }
                        : p,
                    ),
                  )
                }
              />
            </label>
          </fieldset>
        ))}
        <p>
          Total:{" "}
          {preguntas
            .reduce((suma, p) => suma + Number(p.puntaje_obtenido), 0)
            .toFixed(2)}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="boton-primario" disabled={ocupado}>
          {ocupado ? "Guardando…" : "Guardar revisión docente"}
        </button>
      </form>
    </Ventana>
  );
}

