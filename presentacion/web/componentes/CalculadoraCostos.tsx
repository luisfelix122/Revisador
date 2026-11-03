import { useState as usarEstado } from "react";

export function CalculadoraCostos() {
  const [examenes, cambiarExamenes] = usarEstado("1");
  const [contexto, cambiarContexto] = usarEstado("2000");
  const [entrada, cambiarEntrada] = usarEstado("");
  const [salida, cambiarSalida] = usarEstado("");
  const [resultado, cambiarResultado] = usarEstado<string | null>(null);
  const [ocupada, ocupar] = usarEstado(false);
  const [error, mostrarError] = usarEstado("");
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
        Planifica tu lote antes de procesarlo. Introduce las tarifas del modelo
        que elegiste.
      </p>
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
            placeholder="Ej. 1.00"
            value={entrada}
            onChange={(evento) => {
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
            placeholder="Ej. 2.00"
            value={salida}
            onChange={(evento) => {
              cambiarSalida(evento.target.value);
              cambiarResultado(null);
            }}
          />
        </label>
      </div>
      <p className="ayuda-campo">
        Tarifas manuales, no verificadas automáticamente. No es una cotización:
        el costo real depende de las imágenes y de la respuesta del modelo.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {resultado !== null && (
        <div className="resultado-costo" role="status">
          <span>Costo aproximado del lote</span>
          <strong>${resultado} USD</strong>
          <span>No se ha enviado ningún examen a la IA.</span>
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
