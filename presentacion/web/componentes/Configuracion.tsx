import {
  useState as usarEstado,
  useRef as usarReferencia,
  useEffect as usarEfecto,
} from "react";
import {
  ShieldCheck as Escudo,
  CheckCircle2 as Verificado,
} from "lucide-react";
import { Ventana } from "./Ventana";
import {
  leerCredenciales,
  guardarCredenciales,
} from "../servicios/credenciales";
import type { Credenciales } from "../tipos";
import { solicitarConfiguracion } from "../servicios/api";
import { CalculadoraCostos } from "./CalculadoraCostos";

export function Configuracion({
  cerrar,
  alVerificar,
}: {
  cerrar: () => void;
  alVerificar?: (verificada: boolean) => void;
}) {
  const [inicial] = usarEstado(leerCredenciales);
  const [credenciales, cambiarCredenciales] = usarEstado(inicial.credenciales);
  const [recordar, cambiarRecordar] = usarEstado(inicial.recordar);
  const [error, mostrarError] = usarEstado("");
  const [modelos, cambiarModelos] = usarEstado<string[]>([]);
  const [ocupado, ocupar] = usarEstado(false);
  const [exito, mostrarExito] = usarEstado(false);
  const [pestana, cambiarPestana] = usarEstado<"conexion" | "costos">(
    "conexion",
  );
  const peticion = usarReferencia<AbortController | null>(null);
  usarEfecto(() => () => peticion.current?.abort(), []);
  const actualizar = (cambios: Partial<Credenciales>, conservar = recordar) => {
    const nuevas = { ...credenciales, ...cambios };
    cambiarCredenciales(nuevas);
    cambiarRecordar(conservar);
    alVerificar?.(false);
    mostrarExito(false);
    if (cambios.clave !== undefined || cambios.proveedor !== undefined)
      cambiarModelos([]);
    try {
      guardarCredenciales(nuevas, conservar);
      mostrarError("");
    } catch {
      mostrarError(
        "El navegador bloqueó el almacenamiento. Permite el almacenamiento para conservar tu configuración.",
      );
    }
  };
  const consultar = async (ruta: "modelos" | "comprobar-api") => {
    const controlador = new AbortController();
    peticion.current?.abort();
    peticion.current = controlador;
    const temporizador = window.setTimeout(() => controlador.abort(), 30000);
    ocupar(true);
    mostrarError("");
    mostrarExito(false);
    alVerificar?.(false);
    try {
      const datos = await solicitarConfiguracion(
        ruta,
        credenciales,
        controlador.signal,
      );
      if (controlador.signal.aborted) return;
      if (ruta === "modelos") {
        if (
          !Array.isArray(datos?.modelos) ||
          !datos.modelos.every((modelo: unknown) => typeof modelo === "string")
        )
          throw new Error(
            "El servidor devolvió una lista de modelos no válida.",
          );
        cambiarModelos(datos.modelos);
        if (!datos.modelos.length) {
          mostrarError("No hay modelos disponibles para esta clave.");
        } else if (!credenciales.modelo || !datos.modelos.includes(credenciales.modelo)) {
          actualizar({ modelo: datos.modelos[0] });
        }
      }
      if (ruta === "comprobar-api") {
        if (datos?.verificada !== true)
          throw new Error("La conexión no pudo verificarse.");
        mostrarExito(true);
        alVerificar?.(true);
      }
    } catch (problema) {
      if (controlador.signal.aborted) {
        mostrarError(
          "La comprobación se interrumpió o tardó demasiado. Inténtalo otra vez.",
        );
        return;
      }
      mostrarError(
        problema instanceof Error
          ? problema.message
          : "No se pudo conectar. Inténtalo otra vez.",
      );
    } finally {
      window.clearTimeout(temporizador);
      ocupar(false);
    }
  };
  return (
    <Ventana titulo="Configuración de IA" cerrar={cerrar}>
      <div className="pestanas" role="tablist" aria-label="Configuración">
        <button
          role="tab"
          aria-selected={pestana === "conexion"}
          aria-controls="panel-conexion"
          id="tab-conexion"
          onClick={() => cambiarPestana("conexion")}
        >
          Conexión de API
        </button>
        <button
          role="tab"
          aria-selected={pestana === "costos"}
          aria-controls="panel-costos"
          id="tab-costos"
          onClick={() => cambiarPestana("costos")}
        >
          Calculadora de costos
        </button>
      </div>
      <div className="contenido-ventana">
        {pestana === "costos" ? (
          <div role="tabpanel" id="panel-costos" aria-labelledby="tab-costos">
            <CalculadoraCostos />
          </div>
        ) : (
          <div
            role="tabpanel"
            id="panel-conexion"
            aria-labelledby="tab-conexion"
          >
            <p className="descripcion">
              Elige tu proveedor y conecta tu propia clave. Tú mantienes el
              control.
            </p>
            <label>
              Proveedor
              <select
                disabled={ocupado}
                value={credenciales.proveedor}
                onChange={(evento) =>
                  actualizar({
                    proveedor: evento.target.value as Credenciales["proveedor"],
                    modelo: "",
                  })
                }
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>
            <label>
              Clave de API
              <input
                disabled={ocupado}
                type="password"
                value={credenciales.clave}
                onChange={(evento) =>
                  actualizar({ clave: evento.target.value, modelo: "" })
                }
                autoComplete="off"
                spellCheck={false}
                placeholder="Introduce tu clave de API"
              />
            </label>
            <button
              className="boton-contorno cargar-modelos"
              disabled={!credenciales.clave.trim() || ocupado}
              onClick={() => consultar("modelos")}
            >
              Cargar modelos
            </button>
            <label>
              Modelo
              <select
                disabled={!modelos.length || ocupado}
                value={credenciales.modelo}
                onChange={(evento) =>
                  actualizar({ modelo: evento.target.value })
                }
              >
                <option value="">
                  {modelos.length
                    ? "Selecciona un modelo"
                    : "Primero carga los modelos disponibles"}
                </option>
                {credenciales.modelo && !modelos.includes(credenciales.modelo) && (
                  <option value={credenciales.modelo}>
                    {credenciales.modelo} (guardado)
                  </option>
                )}
                {modelos.map((modelo) => {
                  const esRecomendado = [
                    "gemini-flash-lite-latest",
                    "gemini-3.6-flash",
                    "gemini-3.5-flash-lite",
                    "gemini-3-flash-preview",
                  ].includes(modelo);
                  const esAltaDemanda = [
                    "gemini-3.8-flash",
                    "gemini-flash-latest",
                  ].includes(modelo);
                  return (
                    <option key={modelo} value={modelo}>
                      {modelo}{" "}
                      {esRecomendado
                        ? "✨ (Recomendado y rápido con fotos)"
                        : esAltaDemanda
                          ? "⚡ (Último modelo - Alta demanda)"
                          : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <p className="ayuda-campo">
              El proveedor determina qué modelos están disponibles. La
              comprobación realiza una solicitud breve y puede consumir saldo.
            </p>
            <label className="casilla">
              <input
                disabled={ocupado}
                type="checkbox"
                checked={recordar}
                onChange={(evento) => actualizar({}, evento.target.checked)}
              />
              Recordar en este equipo
            </label>
            {recordar && (
              <p className="ayuda-campo">
                Úsalo solo en un dispositivo personal: la clave permanecerá
                guardada después de cerrar la pestaña.
              </p>
            )}
            <p className="aviso-privacidad">
              <Escudo size={19} /> Tu clave se envía al proveedor a través del
              servidor, pero no se guarda en nuestra base de datos.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {exito && (
              <p role="status" className="exito">
                <Verificado size={17} />
                Conexión verificada
              </p>
            )}
            <div className="acciones-ventana">
              <span role="status">
                {ocupado ? "Conectando con tu proveedor…" : ""}
              </span>
              <button
                className="boton-primario"
                disabled={
                  !credenciales.clave.trim() || !credenciales.modelo || ocupado
                }
                onClick={() => consultar("comprobar-api")}
              >
                <Verificado size={17} />
                {ocupado ? "Comprobando…" : "Comprobar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Ventana>
  );
}
