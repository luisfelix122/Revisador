import {
  useState as usarEstado,
  useEffect as usarEfecto,
  useCallback as usarCallback,
  useMemo as usarMemo,
} from "react";
import {
  createClient as crearCliente,
  type SupabaseClient as ClienteSupabase,
  type Session as Sesion,
} from "@supabase/supabase-js";
import { Aplicacion } from "./Aplicacion";
import { Acceso } from "./componentes/Acceso";
import { OrganizarBiblioteca } from "./componentes/OrganizarBiblioteca";
import { NuevaEvaluacion } from "./componentes/NuevaEvaluacion";
import { DetalleEvaluacion } from "./componentes/DetalleEvaluacion";
import { PortalEntregaAlumno } from "./componentes/PortalEntregaAlumno";
import {
  ServicioBiblioteca,
  type Anio,
  type Curso,
} from "./servicios/biblioteca";
import type { NodoAcademico, EvaluacionResumen } from "./tipos";

export function Revisador() {
  const [cliente, cambiarCliente] = usarEstado<ClienteSupabase | null>(null),
    [sesion, cambiarSesion] = usarEstado<Sesion | null>(null),
    [anios, cambiarAnios] = usarEstado<Anio[]>([]),
    [cargando, cargar] = usarEstado(true),
    [error, mostrarError] = usarEstado(""),
    [organizando, organizar] = usarEstado(false),
    [creando, crear] = usarEstado(false),
    [evaluacion, abrirEvaluacion] = usarEstado<string | null>(null),
    [activo, cambiarActivo] = usarEstado<string | undefined>(),
    [verificada, verificar] = usarEstado(false),
    [tokenEntrega, cambiarTokenEntrega] = usarEstado<string | null>(() => {
      if (typeof window === "undefined") return null;
      const params = new URLSearchParams(window.location.search);
      const param = params.get("entrega");
      if (param) return param;
      if (window.location.pathname.startsWith("/entrega/")) {
        const parte = window.location.pathname.replace("/entrega/", "").trim();
        return parte || null;
      }
      return null;
    });
  const servicio = usarMemo(
    () => (cliente ? new ServicioBiblioteca(cliente) : null),
    [cliente],
  );
  usarEfecto(() => {
    let vigente = true;
    let desconectar: (() => void) | undefined;
    (async () => {
      try {
        const respuesta = await fetch("/api/sistema");
        if (!respuesta.ok) throw new Error("No se pudo conectar al servidor");
        const datos = await respuesta.json();
        if (!vigente) return;
        const nuevo = crearCliente(datos.supabase_url, datos.clave_publicable, {
          auth: {
            storage: sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        cambiarCliente(nuevo);
        const {
          data: { session },
        } = await nuevo.auth.getSession();
        if (!vigente) return;
        if (vigente) {
          cambiarSesion(session);
          cargar(false);
        }
        const {
          data: { subscription },
        } = nuevo.auth.onAuthStateChange((_evento, nueva) => {
          if (vigente) {
            cambiarSesion(nueva);
            if (!nueva) {
              cambiarAnios([]);
              abrirEvaluacion(null);
              verificar(false);
            }
          }
        });
        desconectar = () => subscription.unsubscribe();
      } catch (problema) {
        if (vigente) {
          mostrarError(
            problema instanceof Error ? problema.message : "No se pudo cargar",
          );
          cargar(false);
        }
      }
    })();
    return () => {
      vigente = false;
      desconectar?.();
    };
  }, []);
  const actualizar = usarCallback(async () => {
    if (!servicio) return;
    try {
      cambiarAnios(await servicio.biblioteca());
      mostrarError("");
    } catch (problema) {
      mostrarError(
        problema instanceof Error
          ? problema.message
          : "No se pudo cargar la biblioteca",
      );
    }
  }, [servicio]);
  usarEfecto(() => {
    if (sesion) void actualizar();
  }, [sesion?.user.id, actualizar]);
  const cerrarOrganizar = usarCallback(() => organizar(false), []),
    cerrarNueva = usarCallback(() => crear(false), []);
  const cursos: Curso[] = (anios || []).flatMap((a) =>
    (a.facultades || []).flatMap((f) =>
      (f.escuelas || []).flatMap((e) =>
        (e.promociones_ciclos || []).flatMap((c) => c.cursos || []),
      ),
    ),
  );
  const evaluaciones: EvaluacionResumen[] = (cursos || []).flatMap((curso) =>
    (curso.evaluaciones || []).map((evaluacion) => {
      const completados = (evaluacion.examenes_estudiantes || []).filter(
        (e) => e?.estado_revision === "completado",
      );
      return {
        id: evaluacion.id,
        titulo: evaluacion.titulo || "",
        curso: curso.nombre || "",
        fecha: evaluacion.creado_en || new Date().toISOString(),
        cantidadExamenes: completados.length,
        promedio: completados.length
          ? completados.reduce((suma, e) => suma + Number(e?.nota_final || 0), 0) /
            completados.length
          : undefined,
        estado: evaluacion.estado === "borrador" ? "borrador" : "calificado",
      };
    }),
  );
  const nodos: NodoAcademico[] = (anios || []).map((a) => ({
    id: a.id,
    nombre: String(a.anio),
    tipo: 'anios_academicos',
    hijos: (a.facultades || []).map((f) => ({
      id: f.id,
      nombre: f.nombre || "",
      tipo: 'facultades',
      hijos: (f.escuelas || []).map((e) => ({
        id: e.id,
        nombre: e.nombre || "",
        tipo: 'escuelas',
        hijos: (e.promociones_ciclos || []).map((c) => ({
          id: c.id,
          nombre: c.denominacion || "",
          tipo: 'promociones_ciclos',
          hijos: (c.cursos || []).map((curso) => ({
            id: curso.id,
            nombre: curso.nombre || "",
            tipo: 'cursos',
          })),
        })),
      })),
    })),
  }));
  const evaluacionesFiltradas = usarMemo(() => {
    if (!activo) return evaluaciones;
    const cursoSeleccionado = cursos.find((c) => c.id === activo);
    if (cursoSeleccionado) {
      const ids = new Set((cursoSeleccionado.evaluaciones || []).map((x) => x.id));
      return evaluaciones.filter((e) => ids.has(e.id));
    }
    const buscarCursosEnNodo = (nodo: NodoAcademico): string[] => {
      if (nodo.id === activo) {
        const recolectar = (n: NodoAcademico): string[] =>
          !n.hijos || n.hijos.length === 0
            ? [n.id]
            : n.hijos.flatMap(recolectar);
        return recolectar(nodo);
      }
      return (nodo.hijos || []).flatMap(buscarCursosEnNodo);
    };
    const idsCursos = new Set(nodos.flatMap(buscarCursosEnNodo));
    if (idsCursos.size > 0) {
      const cursosRama = cursos.filter((c) => idsCursos.has(c.id));
      const idsEvaluaciones = new Set(
        cursosRama.flatMap((c) => (c.evaluaciones || []).map((x) => x.id)),
      );
      return evaluaciones.filter((e) => idsEvaluaciones.has(e.id));
    }
    return evaluaciones;
  }, [activo, evaluaciones, cursos, nodos]);

  const salir = async () => {
    if (!cliente) return;
    const { error } = await cliente.auth.signOut();
    if (error) {
      mostrarError("No se pudo cerrar sesión. Inténtalo otra vez.");
      return;
    }
    sessionStorage.removeItem("revisador.ia");
    verificar(false);
  };
  if (tokenEntrega) {
    return (
      <PortalEntregaAlumno
        token={tokenEntrega}
        alVolver={() => {
          cambiarTokenEntrega(null);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("entrega");
            window.history.pushState({}, "", url.pathname + (url.search ? url.search : ""));
          }
        }}
      />
    );
  }
  if (cargando)
    return (
      <div className="carga-inicial" role="status">
        Cargando Revisador…
      </div>
    );
  if (!cliente)
    return (
      <div className="carga-inicial">
        <p role="alert">{error}</p>
        <button className="boton-contorno" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
    );
  if (!sesion || !servicio) return <Acceso cliente={cliente} />;
  return (
    <>
      <Aplicacion
        nodos={nodos}
        activo={activo}
        evaluaciones={evaluacionesFiltradas}
        alSeleccionar={(id) => {
          cambiarActivo(id);
          abrirEvaluacion(null);
        }}
        alRegresar={() => {
          cambiarActivo(undefined);
          abrirEvaluacion(null);
        }}
        alCrearEvaluacion={() => crear(true)}
        alOrganizar={() => organizar(true)}
        alEliminarNodo={(nivel, id, nombre) => {
          if (!window.confirm(`¿Eliminar «${nombre}»? Solo se puede eliminar si está vacío.`)) return;
          void servicio.eliminarNodo(nivel, id).then(async () => {
            if (activo === id) cambiarActivo(undefined);
            await actualizar();
          }).catch((problema) => mostrarError(problema instanceof Error ? problema.message : 'No se pudo eliminar.'));
        }}
        alAbrirEvaluacion={abrirEvaluacion}
        alCerrarSesion={() => void salir()}
        alVerificarIA={verificar}
        alVolverBiblioteca={() => abrirEvaluacion(null)}
        contenido={
          evaluacion ? (
            <DetalleEvaluacion
              key={evaluacion}
              identificador={evaluacion}
              servicio={servicio}
              apiVerificada={verificada}
              alVolver={() => {
                abrirEvaluacion(null);
                void actualizar();
              }}
            />
          ) : undefined
        }
      />
      {error && (
        <div role="alert" className="aviso-global">
          <span>{error}</span>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button onClick={() => void actualizar()}>Reintentar</button>
            <button
              className="cerrar-aviso"
              onClick={() => mostrarError("")}
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {organizando && (
        <OrganizarBiblioteca
          servicio={servicio}
          anios={anios}
          cerrar={cerrarOrganizar}
          alGuardar={actualizar}
        />
      )}
      {creando && (
        <NuevaEvaluacion
          servicio={servicio}
          cursos={cursos}
          cursoInicial={cursos.some((curso) => curso.id === activo) ? activo : undefined}
          cerrar={cerrarNueva}
          alOrganizar={() => {
            crear(false);
            organizar(true);
          }}
          alCrear={(id) => {
            crear(false);
            abrirEvaluacion(id);
            void actualizar();
          }}
        />
      )}
    </>
  );
}
