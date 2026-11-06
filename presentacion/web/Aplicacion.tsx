import {
  FolderOpen as CarpetaAbierta,
  Folder as Carpeta,
  Menu,
  Settings as Ajustes,
  Search as Buscar,
  Plus as Agregar,
  Library as Biblioteca,
  Clock3 as Recientes,
  ShieldCheck as Escudo,
  ChevronRight as Flecha,
  LayoutGrid as Cuadricula,
  List as Lista,
  CircleHelp as Ayuda,
  CheckCircle2 as Check,
  SlidersHorizontal as Filtros,
  FileText as Archivo,
  X as Cerrar,
} from "lucide-react";
import {
  useState as usarEstado,
  useCallback as usarCallback,
  useEffect as usarEfecto,
  useRef as usarReferencia,
  type ReactNode as Contenido,
} from "react";
import { Configuracion } from "./componentes/Configuracion";
import { Explorador } from "./componentes/Explorador";
import { Ventana } from "./componentes/Ventana";
import type { NodoAcademico, EvaluacionResumen } from "./tipos";
import { usarPanelMovil } from "./servicios/usarPanelMovil";

function rutaDeNodo(nodos: NodoAcademico[], id?: string): string[] {
  for (const nodo of nodos) {
    if (nodo.id === id) return [nodo.nombre];
    const ruta = rutaDeNodo(nodo.hijos || [], id);
    if (ruta.length) return [nodo.nombre, ...ruta];
  }
  return [];
}

interface Propiedades {
  contenido?: Contenido;
  alOrganizar?: () => void;
  alEliminarNodo?: (tipo: NonNullable<NodoAcademico['tipo']>, id: string, nombre: string) => void;
  alCerrarSesion?: () => void;
  alVerificarIA?: (verificada: boolean) => void;
  alVolverBiblioteca?: () => void;
  nodos?: NodoAcademico[];
  evaluaciones?: EvaluacionResumen[];
  activo?: string;
  alSeleccionar?: (id: string) => void;
  alRegresar?: () => void;
  alCrearEvaluacion?: () => void;
  alAbrirEvaluacion?: (id: string) => void;
}

export function Aplicacion({
  contenido,
  alOrganizar,
  alEliminarNodo,
  alCerrarSesion,
  alVerificarIA,
  alVolverBiblioteca,
  nodos = [],
  evaluaciones = [],
  activo,
  alSeleccionar,
  alRegresar,
  alCrearEvaluacion,
  alAbrirEvaluacion,
}: Propiedades = {}) {
  const [configurando, configurar] = usarEstado(false);
  const [lateralAbierto, abrirLateral] = usarEstado(
    () => window.innerWidth > 760,
  );
  const [busqueda, buscar] = usarEstado("");
  const [vista, cambiarVista] = usarEstado<"cuadricula" | "lista">(
    "cuadricula",
  );
  const [seccion, cambiarSeccion] = usarEstado("biblioteca");
  const [verificada, verificar] = usarEstado(false);
  const [informacion, informar] = usarEstado(false);
  const [tipo, cambiarTipo] = usarEstado("todas");
  const [movil, cambiarMovil] = usarEstado(() => window.innerWidth <= 760);
  const [busquedaAbierta, abrirBusqueda] = usarEstado(false);
  const rutaActiva = rutaDeNodo(nodos, activo);
  const campoBusqueda = usarReferencia<HTMLInputElement>(null);
  const cerrarPanel = usarCallback(() => abrirLateral(false), []);
  const panel = usarPanelMovil(movil && lateralAbierto, cerrarPanel);
  usarEfecto(() => {
    let anterior = window.innerWidth <= 760;
    const adaptar = () => {
      const siguiente = window.innerWidth <= 760;
      if (siguiente === anterior) return;
      anterior = siguiente;
      cambiarMovil(siguiente);
      if (siguiente) abrirLateral(false);
    };
    window.addEventListener("resize", adaptar);
    return () => window.removeEventListener("resize", adaptar);
  }, []);
  usarEfecto(() => {
    if (busquedaAbierta) campoBusqueda.current?.focus();
  }, [busquedaAbierta]);
  const cerrar = usarCallback(() => configurar(false), []);
  const cerrarInformacion = usarCallback(() => informar(false), []);
  const visibles = (evaluaciones || []).filter(
    (evaluacion) =>
      `${evaluacion.titulo || ""} ${evaluacion.curso || ""}`
        .toLocaleLowerCase("es")
        .includes((busqueda || "").toLocaleLowerCase("es")) &&
      (tipo === "todas" || evaluacion.estado === tipo),
  );
  const ordenadas =
    seccion === "recientes"
      ? [...visibles].sort((primera, segunda) =>
          (segunda.fecha || "").localeCompare(primera.fecha || ""),
        )
      : visibles;
  const nueva = () => {
    if (movil) abrirLateral(false);
    if (alCrearEvaluacion) {
      alCrearEvaluacion();
      return;
    }
    informar(true);
  };
  return (
    <div className={`aplicacion ${lateralAbierto ? "" : "lateral-cerrado"}`}>
      <a
        href="#contenido"
        className="saltar"
        tabIndex={movil && lateralAbierto ? -1 : 0}
      >
        Saltar al contenido
      </a>
      <header className="barra-superior" inert={movil && lateralAbierto}>
        <div className="marca">
          <button
            className="boton-icono"
            aria-label="Alternar explorador"
            aria-expanded={lateralAbierto}
            aria-controls="panel-lateral"
            onClick={() => abrirLateral(!lateralAbierto)}
          >
            <Menu size={22} />
          </button>
          <span>Revisador</span>
        </div>
        <label
          className={`buscador ${busquedaAbierta ? "busqueda-abierta" : ""}`}
        >
          <Buscar size={19} />
          <input
            aria-label="Buscar evaluaciones"
            ref={campoBusqueda}
            placeholder="Buscar en tu biblioteca"
            value={busqueda}
            onChange={(evento) => buscar(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") abrirBusqueda(false);
            }}
          />
        </label>
        <div className="acciones-superiores">
          <button
            className="boton-icono buscar-movil"
            aria-label={busquedaAbierta ? "Cerrar búsqueda" : "Abrir búsqueda"}
            aria-expanded={busquedaAbierta}
            onClick={() => abrirBusqueda(!busquedaAbierta)}
          >
            <Buscar size={20} />
          </button>
          <span
            role="status"
            aria-label={verificada ? "API conectada" : "API sin verificar"}
            title={verificada ? "API conectada" : "API sin verificar"}
            className={`estado-api ${verificada ? "verificada" : ""}`}
          >
            {verificada ? (
              <Check size={16} />
            ) : (
              <span className="punto-estado" />
            )}
            <span>{verificada ? "API conectada" : "API sin configurar"}</span>
          </span>
          <button
            className="boton-icono"
            aria-label="Abrir configuración"
            onClick={() => configurar(true)}
          >
            <Ajustes size={21} />
          </button>
          <button
            className="avatar"
            aria-label={
              alCerrarSesion ? "Cerrar sesión" : "Espacio del profesor"
            }
            title={alCerrarSesion ? "Cerrar sesión" : "Espacio del profesor"}
            onClick={alCerrarSesion}
          >
            P
          </button>
        </div>
      </header>
      {lateralAbierto && (
        <>
          <button
            className="fondo-lateral"
            aria-label="Cerrar explorador"
            tabIndex={-1}
            onClick={() => abrirLateral(false)}
          />
          <aside
            ref={panel}
            id="panel-lateral"
            className="panel-lateral"
            role={movil ? "dialog" : undefined}
            aria-modal={movil ? true : undefined}
            aria-label={movil ? "Explorador académico" : undefined}
          >
            {movil && (
              <button
                className="boton-icono cerrar-panel"
                aria-label="Cerrar panel"
                onClick={cerrarPanel}
              >
                <Cerrar size={20} />
              </button>
            )}
            {!alCrearEvaluacion && (
              <p className="alcance-creacion">
                Creación de evaluaciones: próximamente.
              </p>
            )}
            <nav aria-label="Biblioteca">
              <button
                className={`enlace-lateral ${seccion === "biblioteca" ? "activo" : ""}`}
                onClick={() => {
                  cambiarSeccion("biblioteca");
                  alVolverBiblioteca?.();
                }}
              >
                <Biblioteca size={19} /> Mi biblioteca
              </button>
              <button
                className={`enlace-lateral ${seccion === "recientes" ? "activo" : ""}`}
                onClick={() => {
                  cambiarSeccion("recientes");
                  alVolverBiblioteca?.();
                }}
              >
                <Recientes size={19} /> Recientes
              </button>
            </nav>
            <Explorador
              nodos={nodos}
              activo={activo}
              alSeleccionar={(id) => { cambiarSeccion('biblioteca'); buscar(''); cambiarTipo('todas'); alSeleccionar?.(id); if (movil) abrirLateral(false); }}
              alRegresar={alRegresar}
              alOrganizar={alOrganizar}
              alEliminar={alEliminarNodo}
            />
            <div className="pie-lateral">
              <button
                className="enlace-lateral"
                onClick={() => {
                  if (movil) abrirLateral(false);
                  informar(true);
                }}
              >
                <Ayuda size={19} /> Cómo funciona
              </button>
              <div className="nota-lateral">
                <Escudo size={16} />
                <span>Tus criterios. Tu decisión final.</span>
              </div>
            </div>
          </aside>
        </>
      )}
      <main
        id="contenido"
        className="contenido-principal"
        inert={movil && lateralAbierto}
      >
        {contenido ?? (
          <>
            <div className="ruta">
              <Biblioteca size={15} />
              <span>Mi espacio</span>
              <Flecha size={14} />
              <span>
                {seccion === "biblioteca" ? "Biblioteca" : "Recientes"}
              </span>
              {seccion === 'biblioteca' && rutaActiva.map((nombre, indice) => <span key={indice}> › {nombre}</span>)}
            </div>
            <div className="cabecera-contenido">
              <div>
                <h1>
                  {seccion === "biblioteca"
                    ? rutaActiva.at(-1) || "Biblioteca académica"
                    : "Evaluaciones recientes"}
                </h1>
                <p>Un lugar para tus cursos, evaluaciones y resultados.</p>
              </div>
              <button
                className="boton-primario nueva-principal"
                onClick={nueva}
              >
                <Agregar size={18} />{" "}
                {alCrearEvaluacion ? "Nueva evaluación" : "Preparar evaluación"}
              </button>
            </div>
            <div className="barra-archivos">
              <div className="filtro-archivos">
                <Filtros size={16} />
                <label>
                  <span className="solo-lectores">Filtrar evaluaciones</span>
                  <select
                    value={tipo}
                    onChange={(evento) => cambiarTipo(evento.target.value)}
                  >
                    <option value="todas">Todas las evaluaciones</option>
                    <option value="borrador">Borradores</option>
                    <option value="calificado">Calificadas</option>
                  </select>
                </label>
              </div>
              <div className="controles-vista">
                <span>
                  {ordenadas.length}{" "}
                  {ordenadas.length === 1 ? "evaluación" : "evaluaciones"}
                </span>
                <div className="selector-vista">
                  <button
                    className={vista === "cuadricula" ? "elegida" : ""}
                    aria-label="Vista de cuadrícula"
                    aria-pressed={vista === "cuadricula"}
                    onClick={() => cambiarVista("cuadricula")}
                  >
                    <Cuadricula size={17} />
                  </button>
                  <button
                    className={vista === "lista" ? "elegida" : ""}
                    aria-label="Vista de lista"
                    aria-pressed={vista === "lista"}
                    onClick={() => cambiarVista("lista")}
                  >
                    <Lista size={18} />
                  </button>
                </div>
              </div>
            </div>
            {ordenadas.length ? (
              <div className={`evaluaciones ${vista}`}>
                {ordenadas.map((evaluacion) => (
                  <button
                    className="tarjeta-evaluacion"
                    key={evaluacion.id}
                    onClick={() => alAbrirEvaluacion?.(evaluacion.id)}
                    disabled={!alAbrirEvaluacion}
                  >
                    <div className="portada-evaluacion">
                      <Archivo size={35} />
                    </div>
                    <div className="datos-evaluacion">
                      <span className="estado-evaluacion">
                        {evaluacion.estado === "borrador"
                          ? "Borrador"
                          : "Calificada"}
                      </span>
                      <h2>{evaluacion.titulo}</h2>
                      <p>{evaluacion.curso}</p>
                      <div className="metadatos">
                        <span>{evaluacion.cantidadExamenes} exámenes</span>
                        <span>
                          {evaluacion.fecha && !isNaN(new Date(evaluacion.fecha).getTime())
                            ? new Date(evaluacion.fecha).toLocaleDateString(
                                "es-PE",
                                {
                                  timeZone: "America/Lima",
                                },
                              )
                            : ""}
                        </span>
                      </div>
                      {evaluacion.promedio !== undefined && (
                        <p>Promedio: {evaluacion.promedio.toFixed(2)}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <section className="estado-vacio" aria-label="Biblioteca vacía">
                <div className="icono-vacio">
                  <CarpetaAbierta size={72} strokeWidth={1.2} />
                </div>
                <h2>
                  {busqueda || tipo !== "todas"
                    ? "No encontramos evaluaciones"
                    : "Tu próxima evaluación empieza aquí"}
                </h2>
                <p>
                  {busqueda || tipo !== "todas"
                    ? "Prueba con otra búsqueda o cambia el filtro."
                    : "Todavía no hay archivos. Todo está vacío y sin tareas pendientes."}
                </p>
                {!alCrearEvaluacion && (
                  <p className="alcance-creacion">
                    Creación de evaluaciones: próximamente.
                  </p>
                )}
              </section>
            )}
            {!verificada && (
              <section className="panel-conexion">
                <div className="icono-conexion">
                  <Escudo size={23} />
                </div>
                <div>
                  <h2>Todo listo para empezar. Conecta tu IA.</h2>
                  <p>
                    Usa tu propia clave, elige un modelo y comprueba la
                    conexión.
                  </p>
                </div>
                <button
                  className="boton-contorno"
                  onClick={() => configurar(true)}
                >
                  Configurar API <Flecha size={16} />
                </button>
              </section>
            )}
            <footer className="pie-contenido">
              <span>Una ayuda para corregir. El criterio siempre es tuyo.</span>
              <span>Revisador</span>
            </footer>
          </>
        )}
      </main>
      {configurando && (
        <Configuracion
          cerrar={cerrar}
          alVerificar={(estado) => {
            verificar(estado);
            alVerificarIA?.(estado);
          }}
        />
      )}
      {informacion && (
        <Ventana titulo="Tu biblioteca, paso a paso" cerrar={cerrarInformacion}>
          <div className="contenido-ventana guia">
            <p>Conecta tu proveedor de IA desde Configuración.</p>
            <p>
              Organiza tus años, facultades, escuelas, ciclos y cursos en el
              explorador.
            </p>
            <p>
              Adjunta la solución, los materiales y los exámenes. Revisa el
              costo antes de calificar.
            </p>
            {alCrearEvaluacion ? (
              <p className="aviso">Revisa los resultados antes de descargar el acta.</p>
            ) : (
              <p className="aviso">En esta vista la creación y el procesamiento de evaluaciones aún no están conectados.</p>
            )}
            <button
              className="boton-primario"
              onClick={() => {
                informar(false);
                configurar(true);
              }}
            >
              Configurar mi IA
            </button>
          </div>
        </Ventana>
      )}
    </div>
  );
}
