import {
  useState as usarEstado,
  useRef as usarReferencia,
  useEffect as usarEfecto,
} from "react";
import {
  ShieldCheck as Escudo,
  CheckCircle2 as Verificado,
  XCircle as Fallo,
  Plus as Mas,
  Trash2 as Eliminar,
  Layers as Lote,
} from "lucide-react";
import { Ventana } from "./Ventana";
import {
  leerCredenciales,
  guardarCredenciales,
} from "../servicios/credenciales";
import type { Credenciales } from "../tipos";
import {
  solicitarConfiguracion,
  comprobarLoteClaves,
  type ResultadoComprobacionClave,
} from "../servicios/api";

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

  // Estados para múltiples claves y resultados individuales
  const [clavesRespaldo, cambiarClavesRespaldo] = usarEstado<string[]>(
    inicial.credenciales.claves?.filter((c) => c !== inicial.credenciales.clave) ?? [],
  );
  const [estadosClaves, cambiarEstadosClaves] = usarEstado<
    Record<string, { valida?: boolean; mensaje?: string; comprobando?: boolean }>
  >({});

  const peticion = usarReferencia<AbortController | null>(null);
  usarEfecto(() => () => peticion.current?.abort(), []);



  const sincronizar = (
    clavePrincipal: string,
    respaldos: string[],
    cambiosExtra: Partial<Credenciales> = {},
    conservar = recordar,
  ) => {
    const todasLasClaves = [
      clavePrincipal.trim(),
      ...respaldos.map((c) => c.trim()).filter((c) => c && c !== clavePrincipal.trim()),
    ];
    const nuevas: Credenciales = {
      ...credenciales,
      ...cambiosExtra,
      clave: clavePrincipal,
      claves: todasLasClaves,
    };
    cambiarCredenciales(nuevas);
    cambiarRecordar(conservar);
    alVerificar?.(false);
    mostrarExito(false);
    if (cambiosExtra.proveedor !== undefined) cambiarModelos([]);
    try {
      guardarCredenciales(nuevas, conservar);
      mostrarError("");
    } catch {
      mostrarError(
        "El navegador bloqueó el almacenamiento. Permite el almacenamiento para conservar tu configuración.",
      );
    }
  };

  const actualizar = (cambios: Partial<Credenciales>, conservar = recordar) => {
    sincronizar(
      cambios.clave !== undefined ? cambios.clave : credenciales.clave,
      clavesRespaldo,
      cambios,
      conservar,
    );
  };

  const actualizarClaveRespaldo = (indice: number, valor: string) => {
    const copia = [...clavesRespaldo];
    copia[indice] = valor;
    cambiarClavesRespaldo(copia);
    sincronizar(credenciales.clave, copia);
  };

  const agregarClaveRespaldo = () => {
    const copia = [...clavesRespaldo, ""];
    cambiarClavesRespaldo(copia);
  };

  const eliminarClaveRespaldo = (indice: number) => {
    const eliminada = clavesRespaldo[indice];
    const copia = clavesRespaldo.filter((_, i) => i !== indice);
    cambiarClavesRespaldo(copia);
    sincronizar(credenciales.clave, copia);
    if (eliminada) {
      cambiarEstadosClaves((prev) => {
        const nuevo = { ...prev };
        delete nuevo[eliminada];
        return nuevo;
      });
    }
  };

  const comprobarUnaClave = async (claveAComprobar: string) => {
    const claveLimpia = claveAComprobar.trim();
    if (!claveLimpia || !credenciales.modelo) {
      mostrarError("Selecciona un modelo antes de comprobar la clave.");
      return;
    }
    cambiarEstadosClaves((prev) => ({
      ...prev,
      [claveLimpia]: { comprobando: true },
    }));
    try {
      const res = await comprobarLoteClaves(
        credenciales.proveedor,
        [claveLimpia],
        credenciales.modelo,
      );
      const resultado = res[0];
      cambiarEstadosClaves((prev) => ({
        ...prev,
        [claveLimpia]: {
          valida: resultado?.valida ?? false,
          mensaje: resultado?.detalle ?? "Sin respuesta",
          comprobando: false,
        },
      }));
      if (resultado?.valida && claveLimpia === credenciales.clave) {
        mostrarExito(true);
        alVerificar?.(true);
      }
    } catch (err) {
      cambiarEstadosClaves((prev) => ({
        ...prev,
        [claveLimpia]: {
          valida: false,
          mensaje: err instanceof Error ? err.message : "Error",
          comprobando: false,
        },
      }));
    }
  };

  const comprobarTodasEnLote = async () => {
    const todas = [
      credenciales.clave.trim(),
      ...clavesRespaldo.map((c) => c.trim()),
    ].filter(Boolean);
    if (!todas.length || !credenciales.modelo) {
      mostrarError("Asegúrate de ingresar al menos una clave y seleccionar un modelo.");
      return;
    }
    ocupar(true);
    mostrarError("");
    cambiarEstadosClaves((prev) => {
      const nuevo = { ...prev };
      todas.forEach((c) => (nuevo[c] = { comprobando: true }));
      return nuevo;
    });

    try {
      const resultados: ResultadoComprobacionClave[] = await comprobarLoteClaves(
        credenciales.proveedor,
        todas,
        credenciales.modelo,
      );
      const nuevoEstado: Record<
        string,
        { valida: boolean; mensaje: string; comprobando: boolean }
      > = {};
      let algunaValida = false;
      resultados.forEach((r) => {
        nuevoEstado[r.clave] = {
          valida: r.valida,
          mensaje: r.detalle,
          comprobando: false,
        };
        if (r.valida) algunaValida = true;
      });
      cambiarEstadosClaves(nuevoEstado);
      if (nuevoEstado[credenciales.clave.trim()]?.valida) {
        mostrarExito(true);
        alVerificar?.(true);
      } else if (algunaValida) {
        mostrarExito(true);
        alVerificar?.(true);
      } else {
        mostrarError("Ninguna de las claves de API proporcionadas pudo verificarse.");
      }
    } catch (err) {
      mostrarError(
        err instanceof Error
          ? err.message
          : "Error durante la comprobación en lote.",
      );
    } finally {
      ocupar(false);
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
        } else if (
          !credenciales.modelo ||
          !datos.modelos.includes(credenciales.modelo)
        ) {
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
      <div className="contenido-ventana">
          <div>
            <p className="descripcion">
              Elige tu proveedor y conecta tus claves de API. Puedes añadir
              claves de respaldo por si una agota su cuota.
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

            {/* Clave Principal */}
            <div style={{ marginBottom: "14px" }}>
              <label>
                Clave de API
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    disabled={ocupado}
                    type="password"
                    value={credenciales.clave}
                    onChange={(evento) =>
                      actualizar({ clave: evento.target.value, modelo: "" })
                    }
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Introduce tu clave principal"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="boton-contorno"
                    style={{ padding: "6px 12px", whiteSpace: "nowrap" }}
                    disabled={
                      !credenciales.clave.trim() || !credenciales.modelo || ocupado
                    }
                    onClick={() => comprobarUnaClave(credenciales.clave)}
                  >
                    {estadosClaves[credenciales.clave.trim()]?.comprobando
                      ? "..."
                      : "Probar"}
                  </button>
                </div>
              </label>
              {estadosClaves[credenciales.clave.trim()]?.valida === true && (
                <span style={{ color: "#137333", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                  <Verificado size={14} /> Clave principal verificada y lista.
                </span>
              )}
              {estadosClaves[credenciales.clave.trim()]?.valida === false && (
                <span style={{ color: "#d93025", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                  <Fallo size={14} /> {estadosClaves[credenciales.clave.trim()]?.mensaje}
                </span>
              )}
            </div>

            {/* Claves de Respaldo */}
            {clavesRespaldo.map((claveResp, idx) => (
              <div key={idx} style={{ marginBottom: "12px" }}>
                <label>
                  Clave de respaldo #{idx + 1}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      disabled={ocupado}
                      type="password"
                      value={claveResp}
                      onChange={(evento) =>
                        actualizarClaveRespaldo(idx, evento.target.value)
                      }
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={`Introduce clave de respaldo #${idx + 1}`}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="boton-contorno"
                      style={{ padding: "6px 12px", whiteSpace: "nowrap" }}
                      disabled={!claveResp.trim() || !credenciales.modelo || ocupado}
                      onClick={() => comprobarUnaClave(claveResp)}
                    >
                      {estadosClaves[claveResp.trim()]?.comprobando ? "..." : "Probar"}
                    </button>
                    <button
                      type="button"
                      className="boton-contorno"
                      style={{ padding: "6px 8px", color: "#d93025" }}
                      title="Eliminar esta clave"
                      onClick={() => eliminarClaveRespaldo(idx)}
                    >
                      <Eliminar size={16} />
                    </button>
                  </div>
                </label>
                {estadosClaves[claveResp.trim()]?.valida === true && (
                  <span style={{ color: "#137333", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                    <Verificado size={14} /> Clave de respaldo verificada.
                  </span>
                )}
                {estadosClaves[claveResp.trim()]?.valida === false && (
                  <span style={{ color: "#d93025", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                    <Fallo size={14} /> {estadosClaves[claveResp.trim()]?.mensaje}
                  </span>
                )}
              </div>
            ))}

            <div style={{ display: "flex", gap: "10px", margin: "10px 0 16px" }}>
              <button
                type="button"
                className="boton-contorno"
                style={{ fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px" }}
                onClick={agregarClaveRespaldo}
              >
                <Mas size={16} /> Añadir otra clave API
              </button>
              {(clavesRespaldo.length > 0 || credenciales.clave) && (
                <button
                  type="button"
                  className="boton-contorno"
                  style={{ fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px" }}
                  disabled={!credenciales.modelo || ocupado}
                  onClick={comprobarTodasEnLote}
                >
                  <Lote size={16} /> Comprobar todas en lote
                </button>
              )}
            </div>

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
                        ? "(Recomendado y rápido con fotos)"
                        : esAltaDemanda
                          ? "(Último modelo - Alta demanda)"
                          : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <p className="ayuda-campo">
              El proveedor determina qué modelos están disponibles. Si una clave
              agota su cuota durante la revisión, el calificador alternará
              automáticamente a tus claves de respaldo.
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
              <Escudo size={19} /> Tus claves se envían al proveedor a través del
              servidor para validar, pero nunca se guardan en la base de datos.
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
      </div>
    </Ventana>
  );
}
