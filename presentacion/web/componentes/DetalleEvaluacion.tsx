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
  RotateCw as GirarIcon,
  ZoomIn as AcercarIcon,
  ZoomOut as AlejarIcon,
  History as HistorialIcon,
} from "lucide-react";
import { RecepcionAlumnos } from "./RecepcionAlumnos";
import {
  ServicioBiblioteca,
  type EvaluacionDetalle,
  type Pregunta,
  type Examen,
  type PreguntaResultado,
} from "../servicios/biblioteca";
import { leerCredenciales } from "../servicios/credenciales";
import { Ventana } from "./Ventana";
import { SelectorPaginas, prepararFotos, type PaginaExamen } from "./SelectorPaginas";

interface Preparacion {
  examenes: number;
  huella: string;
  costo_usd?: string;
  tarifa_entrada?: string;
  tarifa_salida?: string;
  fuente_tarifas?: string;
  advertencia?: string;
  paginas_examenes?: number | null;
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
    [minimoEditable, cambiarMinimoEditable] = usarEstado(""),
    [paginasDocente, cambiarPaginasDocente] = usarEstado<PaginaExamen[]>([]),
    [paso, cambiarPaso] = usarEstado<1 | 2 | 3>(1),
    [revisando, revisar] = usarEstado<Examen | null>(null);
  const modoEntrega = evaluacion?.modalidad_recepcion ?? "alumnos";
  const manualFinalizada = evaluacion?.carga_manual_finalizada ?? false;
  usarEfecto(() => {
    if (evaluacion) cambiarMinimoEditable(String(evaluacion.puntaje_aprobatorio ?? Math.round(Number(evaluacion.puntaje_total_maximo) * 52.5) / 100));
  }, [evaluacion?.puntaje_aprobatorio, evaluacion?.puntaje_total_maximo]);
  const detener = usarReferencia(false);
  const pasoInicializado = usarReferencia(false);
  const examenesPreparados = usarReferencia<Examen[] | null>(null);
  const configuracionEstimada = usarReferencia<{proveedor: string; clave_api: string; modelo: string; claves_adicionales?: string[]} | null>(null);
  const cargar = usarCallback(async () => {
    const datos = await servicio.evaluacion(identificador);
    if (!pasoInicializado.current) {
      pasoInicializado.current = true;
      if ((datos.examenes_estudiantes || []).some((examen) => examen.estado_revision === "completado")) cambiarPaso(3);
      else if ((datos.soluciones_profesor || []).length) cambiarPaso(2);
    }
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
  const actualizarRecepcion = usarCallback(async () => {
    const datos = await servicio.evaluacion(identificador);
    cambiarEvaluacion((actual) => actual ? {
      ...actual,
      recepcion_abierta: datos.recepcion_abierta,
      fecha_cierre_programada: datos.fecha_cierre_programada,
      tiempo_limite_minutos: datos.tiempo_limite_minutos,
      cantidad_estudiantes_esperados: datos.cantidad_estudiantes_esperados,
      permitir_reenvios_global: datos.permitir_reenvios_global,
      modalidad_recepcion: datos.modalidad_recepcion,
      recepcion_iniciada: datos.recepcion_iniciada,
      carga_manual_finalizada: datos.carga_manual_finalizada,
      examenes_estudiantes: (datos.examenes_estudiantes || []).map((examen) => ({...examen, detalles_preguntas: examen.detalles_preguntas || []})),
    } : actual);
  }, [identificador, servicio]);
  const actualizarModalidad = async (modalidad: "alumnos" | "manual", finalizada?: boolean) => {
    ocupar(true);
    mostrarError("");
    try {
      await servicio.configurarModalidad(identificador, modalidad, finalizada);
      await actualizarRecepcion();
    } catch (problema) {
      mostrarError(mensaje(problema));
    } finally {
      ocupar(false);
    }
  };
  usarEfecto(() => {
    if (paso !== 2 || modoEntrega !== 'alumnos' || !evaluacion?.recepcion_abierta) return;
    const intervalo = window.setInterval(() => void actualizarRecepcion().catch(() => {}), 10000);
    return () => window.clearInterval(intervalo);
  }, [paso, modoEntrega, evaluacion?.recepcion_abierta, actualizarRecepcion]);
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
    const adicionales = (credenciales.claves || []).filter(
      (c) => c && c.trim() !== '' && c !== credenciales.clave,
    );
    return {
      proveedor: credenciales.proveedor,
      clave_api: credenciales.clave,
      modelo: credenciales.modelo,
      claves_adicionales: adicionales,
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
  const subirFotosAlumno = async () => {
    if (!paginasDocente.length) return;
    ocupar(true); mostrarError(""); avisar(""); invalidar();
    try {
      const formulario = await prepararFotos(paginasDocente);
      await servicio.subirExamenFotos(identificador, formulario);
      cambiarPaginasDocente([]);
      await cargar();
      avisar("Las fotos se guardaron juntas como un examen.");
    } catch (problema) { mostrarError(mensaje(problema)); }
    finally { ocupar(false); }
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
  const preparar = async (examenes?: Examen[]) => {
    ocupar(true);
    mostrarError("");
    invalidar();
    try {
      const configuracion = credenciales();
      const resultado = await servicio.datos<Preparacion>(
        `/evaluaciones/${identificador}/preparar`, { method: "POST", body: JSON.stringify({ proveedor: configuracion.proveedor, modelo: configuracion.modelo, ...(examenes ? {examenes_ids: examenes.map((examen) => examen.id)} : {}) }) },
      );
      configuracionEstimada.current = configuracion;
      examenesPreparados.current = examenes ?? null;
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
    const pendientes = examenesPreparados.current ?? evaluacion.examenes_estudiantes.filter(
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
          if (examen.estado_revision === "completado") {
            await servicio.reiniciarExamen(identificador, examen.id);
          }
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
  const alCalificarLote = async (
    modo: "pendientes" | "todos" | "seleccionados",
    seleccionados?: string[],
  ) => {
    if (!evaluacion) return;
    if (!apiVerificada) {
      mostrarError("Abre Configuración y comprueba la conexión de IA antes de calificar.");
      return;
    }
    if (!evaluacion.soluciones_profesor.length) {
      mostrarError("Adjunta la solución oficial en la pestaña 'Carga docente' antes de calificar.");
      return;
    }
    if (!guardada || !rubrica.length) {
      mostrarError("Confirma la rúbrica de corrección antes de calificar.");
      return;
    }

    let examenesAProcesar: Examen[] = [];
    if (modo === "pendientes") {
      examenesAProcesar = evaluacion.examenes_estudiantes.filter(
        (e) => e.estado_revision !== "completado",
      );
    } else if (modo === "todos") {
      examenesAProcesar = [...evaluacion.examenes_estudiantes];
    } else if (modo === "seleccionados") {
      const setSeleccionados = new Set(seleccionados || []);
      examenesAProcesar = evaluacion.examenes_estudiantes.filter((e) =>
        setSeleccionados.has(e.id),
      );
    }

    if (examenesAProcesar.length === 0) {
      avisar("No hay exámenes para calificar con el criterio seleccionado.");
      return;
    }

    cambiarPaso(3);
    await preparar(examenesAProcesar);
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
    minimoAprobatorio = Number(evaluacion.puntaje_aprobatorio ?? Math.round(Number(evaluacion.puntaje_total_maximo) * 52.5) / 100),
    resultados = completados.filter(
      (e) =>
        (e.nombre_estudiante + " " + e.codigo_estudiante)
          .toLocaleLowerCase("es")
          .includes(busqueda.toLocaleLowerCase("es")) &&
        (filtro === "todos" ||
          (filtro === "aprobados" && e.nota_final >= minimoAprobatorio) ||
          (filtro === "desaprobados" && e.nota_final < minimoAprobatorio) ||
          (filtro === "nada" && e.nombre_estudiante === "nada")),
    );
  const cursoObj = evaluacion.cursos;
  const cicloObj = cursoObj?.promociones_ciclos;
  const escuelaObj = cicloObj?.escuelas;
  const facultadObj = escuelaObj?.facultades;
  const anioObj = facultadObj?.anios_academicos;

  const migasJerarquia = [
    anioObj?.anio ? `Año ${anioObj.anio}` : null,
    facultadObj?.nombre,
    escuelaObj?.nombre,
    cicloObj?.denominacion,
    cursoObj?.nombre,
  ].filter(Boolean);
  const puedePrepararCriterios = evaluacion.soluciones_profesor.length > 0 || completados.length > 0;
  const cupoCompleto = Boolean(evaluacion.cantidad_estudiantes_esperados && evaluacion.examenes_estudiantes.length >= evaluacion.cantidad_estudiantes_esperados);
  const plazoVencido = Boolean(evaluacion.fecha_cierre_programada && Date.parse(evaluacion.fecha_cierre_programada) <= Date.now());
  const recepcionTerminada = modoEntrega === 'manual'
    ? evaluacion.examenes_estudiantes.length > 0 && manualFinalizada
    : Boolean(evaluacion.recepcion_iniciada && (plazoVencido || cupoCompleto || !evaluacion.recepcion_abierta));
  const puedeRevisar = completados.length > 0 || (guardada && recepcionTerminada && evaluacion.examenes_estudiantes.length > 0);

  return (
    <section className="detalle">
      <button className="boton-texto" onClick={alVolver} disabled={corriendo}>
        <Regresar size={17} />
        Volver a la biblioteca
      </button>
      <div className="cabecera-detalle">
        <div>
          {migasJerarquia.length > 0 && (
            <div className="jerarquia-migas">
              {migasJerarquia.join("  ›  ")}
            </div>
          )}
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
      <form className="ajuste-aprobacion" onSubmit={(evento) => {
        evento.preventDefault();
        if (!minimoEditable.trim()) { mostrarError("Escribe el puntaje mínimo para aprobar."); return; }
        const valor = Number(minimoEditable);
        if (!Number.isFinite(valor) || valor < 0 || valor > Number(evaluacion.puntaje_total_maximo)) { mostrarError("El mínimo debe estar entre cero y el puntaje máximo."); return; }
        ocupar(true); mostrarError("");
        void servicio.configurarPuntajeAprobatorio(identificador, valor).then(async () => {
          await cargar(); avisar("Puntaje mínimo actualizado.");
        }).catch((problema) => mostrarError(mensaje(problema))).finally(() => ocupar(false));
      }}>
        <label>Puntaje mínimo para aprobar<input type="number" min="0" max={evaluacion.puntaje_total_maximo} step="0.01" value={minimoEditable} onChange={(evento) => cambiarMinimoEditable(evento.target.value)} /></label>
        <button type="submit" className="boton-contorno" disabled={ocupado || corriendo || minimoEditable.trim() === "" || Number(minimoEditable) === minimoAprobatorio}>Guardar mínimo</button>
      </form>
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
          <nav className="pasos-evaluacion" aria-label="Pasos para revisar la evaluación">
            {([
              {numero: 1, titulo: 'Archivos', detalle: 'Prepara el material'},
              {numero: 2, titulo: 'Criterios', detalle: 'Define la rúbrica'},
              {numero: 3, titulo: 'Revisión', detalle: 'Confirma y califica'},
            ] as const).map((item) => (
              <button key={item.numero} type="button" className={`paso-evaluacion ${paso === item.numero ? 'activo' : ''}`} aria-current={paso === item.numero ? 'step' : undefined} disabled={(item.numero === 2 && !puedePrepararCriterios) || (item.numero === 3 && !puedeRevisar)} onClick={() => cambiarPaso(item.numero)}>
                <span className="paso-numero">{item.numero}</span>
                <span><strong>Paso {item.numero} · {item.titulo}</strong><small>{item.detalle}</small></span>
              </button>
            ))}
          </nav>
          <section className="seccion-evaluacion" aria-labelledby="titulo-archivos" hidden={paso !== 1}>
        <h2 id="titulo-archivos">Solución y materiales de apoyo</h2>
        <p className="descripcion">
          Hasta 3 MB por archivo y 20 páginas por documento. El
          material de apoyo es opcional. La subida no inicia la calificación.
        </p>
        <div className="cargas-archivos">
          <label>
            Solución oficial
            {!evaluacion.soluciones_profesor.length && <input
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
            />}
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
        <div className="navegacion-pasos"><span>{puedePrepararCriterios ? 'Puedes volver a este paso en cualquier momento.' : 'Adjunta la solución oficial para continuar.'}</span><button type="button" className="boton-primario" disabled={!puedePrepararCriterios} onClick={() => cambiarPaso(2)}>Continuar a criterios</button></div>
      </section>
      <section className="seccion-evaluacion" hidden={paso !== 2}>
        <h2>Criterios de corrección</h2>
        <p className="descripcion">
          Extrae los criterios de la solución o escríbelos manualmente. Revisa
          las respuestas esperadas y asegúrate de que sumen{" "}
          {evaluacion.puntaje_total_maximo} puntos.
        </p>
        <div className="modalidades-entrega" aria-label="Forma de recepción">
          <h3>Recepción de exámenes</h3>
          <p>Elige cómo recibirá el docente los exámenes de esta evaluación.</p>
          <div className="pestanas-modalidad">
            <button type="button" className={`pestana-boton ${modoEntrega === "alumnos" ? "activa" : ""}`} disabled={ocupado || corriendo} onClick={() => { if (modoEntrega !== "alumnos") void actualizarModalidad("alumnos"); }}>Enlace para alumnos</button>
            <button type="button" className={`pestana-boton ${modoEntrega === "manual" ? "activa" : ""}`} disabled={ocupado || corriendo} onClick={() => { if (modoEntrega !== "manual") void actualizarModalidad("manual"); }}>Carga manual del docente</button>
          </div>
          {modoEntrega === "alumnos" ? (
            <RecepcionAlumnos vista="recepcion" evaluacion={evaluacion} servicio={servicio} apiVerificada={apiVerificada} alActualizar={actualizarRecepcion} alRevisarExamen={(examen) => revisar(examen)} alCalificarLote={alCalificarLote} ocupado={ocupado} corriendo={corriendo} />
          ) : (
            <div className="cargas-archivos">
          <label>
            Exámenes de estudiantes
            {!manualFinalizada && (            <input
              aria-label="Exámenes de estudiantes"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp"
              disabled={ocupado || corriendo || bloqueada}
              onChange={(evento) => {
                void subir("examen", evento.target.files);
                evento.target.value = "";
              }}
            />)}
            <span>
              {evaluacion.examenes_estudiantes.length}/100 exámenes guardados
            </span>
          </label>
              <label className="casilla"><input type="checkbox" checked={manualFinalizada} disabled={!evaluacion.examenes_estudiantes.length || ocupado || paginasDocente.length > 0} onChange={(evento) => void actualizarModalidad("manual", evento.target.checked)} />Terminé de cargar los exámenes</label>
              {!manualFinalizada && <div className="carga-varias-paginas"><h4>Varias fotos de un estudiante</h4><p>Selecciona todas las páginas de un alumno para guardarlas como un solo examen.</p><SelectorPaginas paginas={paginasDocente} alCambiar={cambiarPaginasDocente} deshabilitado={ocupado || corriendo || bloqueada} /><button type="button" className="boton-primario" disabled={!paginasDocente.length || ocupado || corriendo || bloqueada} onClick={() => void subirFotosAlumno()}>Guardar examen de este estudiante</button></div>}
            </div>
          )}
          {!recepcionTerminada && <p className="ayuda-campo">Para analizar la solución, termina la carga manual o espera a que se complete el aforo o se cierre la recepción.</p>}
        </div>
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
                !recepcionTerminada ||
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
        <div className="navegacion-pasos"><button type="button" className="boton-texto" onClick={() => cambiarPaso(1)}>Volver a archivos</button><button type="button" className="boton-primario" disabled={!puedeRevisar} onClick={() => cambiarPaso(3)}>Continuar al resumen</button></div>
      </section>
      {paso === 3 && <RecepcionAlumnos vista="revision" evaluacion={evaluacion} servicio={servicio} apiVerificada={apiVerificada} alActualizar={cargar} alRevisarExamen={(examen) => revisar(examen)} alCalificarLote={alCalificarLote} ocupado={ocupado} corriendo={corriendo} />}
      <section className="seccion-evaluacion" hidden={paso !== 3}>
        <h2>Resumen de revisión</h2>
        <p className="descripcion">
          Comprueba el lote y el costo estimado antes de enviar los exámenes a tu proveedor de IA.
        </p>
        <div className="resumen-preparacion">
          <div><span>Solución</span><strong>{evaluacion.soluciones_profesor.length ? 'Lista' : 'Pendiente'}</strong></div>
          <div><span>Rúbrica</span><strong>{guardada ? 'Guardada' : 'Pendiente'}</strong></div>
          <div><span>Exámenes pendientes</span><strong>{evaluacion.examenes_estudiantes.length - completados.length}</strong></div>
          <div><span>Conexión de IA</span><strong>{apiVerificada ? 'Verificada' : 'Pendiente'}</strong></div>
        </div>
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
            <strong>Resumen del lote · {estimacion.examenes} {estimacion.examenes === 1 ? "examen" : "exámenes"}</strong>
            {estimacion.paginas_examenes != null && <p>Páginas de exámenes: {estimacion.paginas_examenes}</p>}
            {configuracionEstimada.current && <p>Modelo: {configuracionEstimada.current.modelo}</p>}
            {estimacion.costo_usd && (
              <p style={{ margin: "6px 0", color: "#137333", fontWeight: 600 }}>
                Costo estimado: ~${Number(estimacion.costo_usd).toFixed(4)} USD
                {estimacion.fuente_tarifas && (
                  <span style={{ fontSize: "12px", color: "#5f6368", display: "block", fontWeight: "normal" }}>
                    ({estimacion.fuente_tarifas})
                  </span>
                )}
              </p>
            )}
            {!estimacion.costo_usd && <p>{estimacion.advertencia || "No hay una estimación automática disponible para esta selección. Consulta las tarifas del proveedor antes de continuar."}</p>}
            <p>Se enviarán la solución, los materiales, las indicaciones y los exámenes al proveedor seleccionado. El cálculo usa una cantidad estimada de tokens; el costo real puede variar según el contenido, las páginas y las tarifas vigentes.</p>
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
      <section className="seccion-evaluacion" hidden={paso !== 3}>
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
                <dt>Aprobados (≥{minimoAprobatorio.toLocaleString("es-PE")})</dt>
                <dd>
                  {Math.round(
                    (completados.filter((e) => e.nota_final >= minimoAprobatorio).length /
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
                          examen.nota_final >= minimoAprobatorio
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
    [error, mostrarError] = usarEstado(""),
    [rotacion, cambiarRotacion] = usarEstado(0),
    [zoom, cambiarZoom] = usarEstado(1),
    [rutaActiva, cambiarRutaActiva] = usarEstado(examen.ruta_imagen_examen || ""),
    [imagenUrl, cambiarImagenUrl] = usarEstado<string | null>(null),
    [cargandoImagen, cambiarCargandoImagen] = usarEstado(false);

  const historial = examen.historial_entregas_estudiantes || [];

  usarEfecto(() => {
    let activo = true;
    let urlCreada: string | null = null;
    if (!rutaActiva) {
      cambiarImagenUrl(null);
      return;
    }
    cambiarCargandoImagen(true);
    servicio
      .obtenerArchivoExamenUrl(evaluacionId, examen.id, rutaActiva)
      .then((url) => {
        if (activo) { urlCreada = url; cambiarImagenUrl(url); }
        else URL.revokeObjectURL?.(url);
      })
      .catch(() => {
        if (activo) cambiarImagenUrl(null);
      })
      .finally(() => {
        if (activo) cambiarCargandoImagen(false);
      });
    return () => {
      activo = false;
      if (urlCreada) URL.revokeObjectURL?.(urlCreada);
    };
  }, [evaluacionId, examen.id, rutaActiva, servicio]);

  const girar = () => cambiarRotacion((prev) => (prev + 90) % 360);
  const acercar = () => cambiarZoom((z) => Math.min(z + 0.25, 3));
  const alejar = () => cambiarZoom((z) => Math.max(z - 0.25, 0.75));

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
    <Ventana titulo={`Revisión de examen · ${codigo || "Estudiante"}`} cerrar={cerrar} amplia>
      <div className="revision-contenedor-dividido">
        {/* Columna Visor de Examen */}
        <section className="visor-columna" aria-label="Visor de examen del estudiante">
          <div className="visor-herramientas">
            <span className="visor-etiqueta">
              {examen.numero_entregas && examen.numero_entregas > 1
                ? `Entrega activa #${examen.numero_entregas}`
                : "Examen entregado"}
            </span>
            {!rutaActiva.toLowerCase().endsWith('.pdf') && <div className="visor-botones">
              <button
                type="button"
                className="boton-icono pequeno"
                onClick={girar}
                title="Girar 90°"
                aria-label="Girar 90°"
              >
                <GirarIcon size={16} />
              </button>
              <button
                type="button"
                className="boton-icono pequeno"
                onClick={alejar}
                title="Alejar"
                aria-label="Alejar"
                disabled={zoom <= 0.75}
              >
                <AlejarIcon size={16} />
              </button>
              <span className="zoom-indicador">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="boton-icono pequeno"
                onClick={acercar}
                title="Acercar"
                aria-label="Acercar"
                disabled={zoom >= 3}
              >
                <AcercarIcon size={16} />
              </button>
            </div>}
          </div>

          {historial.length > 1 && (
            <div className="selector-versiones">
              <label htmlFor="version-entrega">
                <HistorialIcon size={14} />
                Historial de entregas:
              </label>
              <select
                id="version-entrega"
                value={rutaActiva}
                onChange={(e) => cambiarRutaActiva(e.target.value)}
              >
                {historial.map((h) => (
                  <option key={h.id} value={h.ruta_archivo}>
                    Entrega #{h.numero_entrega} — {new Date(h.creado_en).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    {h.ruta_archivo === examen.ruta_imagen_examen ? " (Actual)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="visor-lienzo">
            {cargandoImagen ? (
              <p className="visor-mensaje" role="status">Cargando archivo de examen…</p>
            ) : imagenUrl && rutaActiva.toLowerCase().endsWith('.pdf') ? (
              <div className="visor-contenedor-pdf"><iframe title={`PDF del examen de ${nombre}`} src={imagenUrl} className="visor-pdf" /><a href={imagenUrl} target="_blank" rel="noopener noreferrer">Abrir PDF en otra pestaña</a></div>
            ) : imagenUrl ? (
              <div className="visor-marco-imagen">
                <img
                  src={imagenUrl}
                  alt={`Examen de ${nombre}`}
                  style={{
                    transform: `rotate(${rotacion}deg) scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: "transform 0.2s ease-out",
                    maxWidth: "100%",
                  }}
                />
              </div>
            ) : (
              <p className="visor-mensaje">
                No hay vista previa disponible para este archivo.
              </p>
            )}
          </div>
        </section>

        {/* Columna Formulario de Revisión */}
        <form className="formulario-revision-columna" onSubmit={guardar}>
          <div className="campos-dobles">
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
          </div>
          <div className="lista-preguntas-revision">
            {preguntas.map((pregunta, indice) => (
              <fieldset key={pregunta.numero_pregunta}>
                <legend>
                  Pregunta {pregunta.numero_pregunta} · máximo {pregunta.puntaje_maximo}
                </legend>
                <label>
                  Respuesta detectada
                  <textarea
                    value={pregunta.respuesta_detectada}
                    maxLength={10000}
                    rows={2}
                    onChange={(evento) => {
                      const respuesta = evento.target.value;
                      cambiarPreguntas(
                        preguntas.map((p, i) =>
                          i === indice
                            ? {
                                ...p,
                                respuesta_detectada: respuesta,
                                puntaje_obtenido: respuestaAusente(respuesta) ? 0 : p.puntaje_obtenido,
                              }
                            : p
                        )
                      );
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
                            : p
                        )
                      )
                    }
                  />
                </label>
                {respuestaAusente(pregunta.respuesta_detectada) && (
                  <p className="ayuda-campo">Las respuestas sin contestar reciben cero puntos.</p>
                )}
                <label>
                  Justificación de la IA
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
                            : p
                        )
                      )
                    }
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <div className="pie-formulario-revision">
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
          </div>
        </form>
      </div>
    </Ventana>
  );
}

