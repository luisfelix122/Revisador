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
    [verificada, verificar] = usarEstado(false);
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
        const nuevo = crearCliente(datos.supabase_url, datos.clave_publicable, {
          auth: {
            storage: sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        if (!vigente) return;
        cambiarCliente(nuevo);
        const {
          data: { session },
        } = await nuevo.auth.getSession();
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
  const cursos: Curso[] = anios.flatMap((a) =>
    a.facultades.flatMap((f) =>
      f.escuelas.flatMap((e) => e.promociones_ciclos.flatMap((c) => c.cursos)),
    ),
  );
  const evaluaciones: EvaluacionResumen[] = cursos.flatMap((curso) =>
    curso.evaluaciones.map((evaluacion) => {
      const completados = evaluacion.examenes_estudiantes.filter(
        (e) => e.estado_revision === "completado",
      );
      return {
        id: evaluacion.id,
        titulo: evaluacion.titulo,
        curso: curso.nombre,
        fecha: evaluacion.creado_en,
        cantidadExamenes: completados.length,
        promedio: completados.length
          ? completados.reduce((suma, e) => suma + Number(e.nota_final), 0) /
            completados.length
          : undefined,
        estado: evaluacion.estado === "borrador" ? "borrador" : "calificado",
      };
    }),
  );
  const nodos: NodoAcademico[] = anios.map((a) => ({
    id: a.id,
    nombre: String(a.anio),
    hijos: a.facultades.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      hijos: f.escuelas.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        hijos: e.promociones_ciclos.map((c) => ({
          id: c.id,
          nombre: c.denominacion,
          hijos: c.cursos.map((curso) => ({
            id: curso.id,
            nombre: curso.nombre,
          })),
        })),
      })),
    })),
  }));
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
        evaluaciones={
          activo
            ? evaluaciones.filter(
                (e) =>
                  cursos
                    .find((c) => c.id === activo)
                    ?.evaluaciones.some((x) => x.id === e.id) ?? true,
              )
            : evaluaciones
        }
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
          {error}
          <button onClick={() => void actualizar()}>Reintentar</button>
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
          cerrar={cerrarNueva}
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
