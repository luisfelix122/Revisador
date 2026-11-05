import { useState as usarEstado, useRef as usarReferencia } from "react";
import { Coins as Monedas, RefreshCw as Recargar } from "lucide-react";
import { consultarTarifasOficiales, type TarifasOficiales } from "../servicios/api";
import { leerCredenciales } from "../servicios/credenciales";

const MODELOS_COMUNES = [
  { id: "gemini-flash-lite-latest", etiqueta: "Gemini Flash-Lite Latest (Recomendado y económico)" },
  { id: "gemini-3.6-flash", etiqueta: "Gemini 3.6 Flash (Equilibrado)" },
  { id: "gemini-3.5-flash-lite", etiqueta: "Gemini 3.5 Flash-Lite" },
  { id: "gemini-3.8-flash", etiqueta: "Gemini 3.8 Flash (Alta inteligencia)" },
  { id: "gemini-flash-latest", etiqueta: "Gemini Flash Latest" },
];

const TARIFAS_DEFECTO: Record<string, { entrada: string; salida: string }> = {
  "gemini-flash-lite-latest": { entrada: "0.30", salida: "2.50" },
  "gemini-3.5-flash-lite": { entrada: "0.30", salida: "2.50" },
  "gemini-3.6-flash": { entrada: "0.75", salida: "3.75" },
  "gemini-3.8-flash": { entrada: "0.75", salida: "3.75" },
  "gemini-flash-latest": { entrada: "0.75", salida: "3.75" },
};

export function CalculadoraCostos() {
  const [configuracion] = usarEstado(() => leerCredenciales().credenciales);
  const [modeloSeleccionado, cambiarModeloSeleccionado] = usarEstado(
    configuracion.modelo || "gemini-flash-lite-latest",
  );
  const modeloActual = configuracion.modelo || "gemini-flash-lite-latest";
  const tarifasIniciales = configuracion.proveedor === 'openai' ? undefined : TARIFAS_DEFECTO[modeloActual];
  const [examenes, cambiarExamenes] = usarEstado("20");
  const [contexto, cambiarContexto] = usarEstado("2000");
  const [entrada, cambiarEntrada] = usarEstado(tarifasIniciales?.entrada ?? "");
  const [salida, cambiarSalida] = usarEstado(tarifasIniciales?.salida ?? "");
  const [tarifasInfo, cambiarTarifasInfo] = usarEstado<TarifasOficiales | null>(null);
  const [resultado, cambiarResultado] = usarEstado<string | null>(null);
  const [ocupada, ocupar] = usarEstado(false);
  const [cargandoTarifas, cambiarCargandoTarifas] = usarEstado(false);
  const [error, mostrarError] = usarEstado("");
  const solicitudTarifas = usarReferencia(0);

  const cargarTarifas = async (modelo: string) => {
    const solicitud = ++solicitudTarifas.current;
    cambiarCargandoTarifas(true);
    try {
      const datos = await consultarTarifasOficiales(
        configuracion.proveedor || "gemini",
        modelo,
      );
      if (solicitud === solicitudTarifas.current && datos && datos.tarifa_entrada && datos.tarifa_salida) {
        cambiarTarifasInfo(datos);
        cambiarEntrada(datos.tarifa_entrada);
        cambiarSalida(datos.tarifa_salida);
      }
    } catch {
      // Si falla, se pueden ingresar manualmente
    } finally {
      if (solicitud === solicitudTarifas.current) cambiarCargandoTarifas(false);
    }
  };

  const calcular = async () => {
    ocupar(true);
    mostrarError("");
    cambiarResultado(null);
    try {
      const respuesta = await fetch("/api/evaluaciones/calcular-costo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cantidad_examenes: Number(examenes),
          tokens_solucion: Number(contexto),
          tokens_materiales: 0,
          tokens_indicaciones: 0,
          tokens_imagen: 2000,
          tokens_retroalimentacion: 500,
          tarifa_entrada: entrada,
          tarifa_salida: salida,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const datos = await respuesta.json();
      if (
        !respuesta.ok ||
        typeof datos.costo_usd !== "string" ||
        !Number.isFinite(Number(datos.costo_usd))
      )
        throw new Error(
          "Revisa las cantidades y tarifas e inténtalo otra vez.",
        );
      cambiarResultado(Number(datos.costo_usd).toFixed(4));
    } catch (problema) {
      mostrarError(
        problema instanceof Error
          ? problema.message
          : "No se pudo calcular. Comprueba el servidor.",
      );
    } finally {
      ocupar(false);
    }
  };

  return (
    <section aria-label="Estimador de costos">
      <p className="descripcion">
        Planifica tu presupuesto antes de calificar. Comprueba las tarifas del modelo con tu proveedor antes de calcular.
      </p>

      <label style={{ marginBottom: "12px", display: "block" }}>
        Modelo para estimar
        <select
          value={modeloSeleccionado}
          onChange={(e) => {
            const nuevoModelo = e.target.value;
            cambiarModeloSeleccionado(nuevoModelo);
            cambiarTarifasInfo(null);
            cambiarEntrada("");
            cambiarSalida("");
            void cargarTarifas(nuevoModelo);
            cambiarResultado(null);
          }}
        >
          {configuracion.modelo && !MODELOS_COMUNES.some((modelo) => modelo.id === configuracion.modelo) && (
            <option value={configuracion.modelo}>{configuracion.modelo}</option>
          )}
          {configuracion.proveedor !== 'openai' && MODELOS_COMUNES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {tarifasInfo && (
        <div
          style={{
            background: "#e8f0fe",
            border: "1px solid #d2e3fc",
            borderRadius: "6px",
            padding: "8px 12px",
            marginBottom: "14px",
            fontSize: "0.85rem",
            color: "#174ea6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Monedas size={16} />
            <span>
              Tarifas de referencia: <strong>${tarifasInfo.tarifa_entrada}</strong> entrada /{" "}
              <strong>${tarifasInfo.tarifa_salida}</strong> salida por 1M tokens
            </span>
          </div>
          <button
            type="button"
            className="boton-contorno"
            style={{ padding: "2px 6px", fontSize: "0.75rem", background: "white" }}
            onClick={() => void cargarTarifas(modeloSeleccionado)}
            title="Refrescar tarifas en vivo"
          >
            <Recargar size={12} className={cargandoTarifas ? "girando" : ""} />
          </button>
        </div>
      )}

      <div className="campos-dobles">
        <label>
          Exámenes a procesar
          <input
            type="number"
            min="1"
            max="10000"
            value={examenes}
            onChange={(evento) => {
              cambiarExamenes(evento.target.value);
              cambiarResultado(null);
            }}
          />
        </label>
        <label>
          Tokens de contexto por examen
          <input
            type="number"
            min="0"
            value={contexto}
            onChange={(evento) => {
              cambiarContexto(evento.target.value);
              cambiarResultado(null);
            }}
          />
        </label>
      </div>
      <p className="ayuda-campo">
        Incluye en el contexto la solución, materiales e indicaciones. Supuesto:
        2.000 tokens de imagen y 500 de retroalimentación por examen.
      </p>
      <div className="campos-dobles">
        <label>
          Tarifa de entrada (USD / millón)
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Ej. 0.30"
            value={entrada}
            onChange={(evento) => {
              solicitudTarifas.current++;
              cambiarCargandoTarifas(false);
              cambiarTarifasInfo(null);
              cambiarEntrada(evento.target.value);
              cambiarResultado(null);
            }}
          />
        </label>
        <label>
          Tarifa de salida (USD / millón)
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Ej. 2.50"
            value={salida}
            onChange={(evento) => {
              solicitudTarifas.current++;
              cambiarCargandoTarifas(false);
              cambiarTarifasInfo(null);
              cambiarSalida(evento.target.value);
              cambiarResultado(null);
            }}
          />
        </label>
      </div>
      <p className="ayuda-campo">
        Las tarifas pueden cambiar. No es una cotización: el costo real depende de las imágenes y tokens del modelo.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {resultado !== null && (
        <div className="resultado-costo" role="status">
          <span>Costo aproximado del lote ({examenes} exámenes)</span>
          <strong>${resultado} USD</strong>
          <span>Calculado con las tarifas indicadas para {modeloSeleccionado}.</span>
        </div>
      )}
      <button
        className="boton-primario calcular"
        disabled={
          ocupada ||
          !entrada ||
          !salida ||
          !examenes ||
          !contexto ||
          Number(examenes) < 1
        }
        onClick={calcular}
      >
        {ocupada ? "Calculando…" : "Calcular estimación"}
      </button>
    </section>
  );
}
