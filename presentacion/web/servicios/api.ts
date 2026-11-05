import type { Credenciales } from "../tipos";

export async function solicitarConfiguracion(
  ruta: "modelos" | "comprobar-api",
  credenciales: Credenciales,
  senal: AbortSignal,
) {
  const respuesta = await fetch(`/api/configuracion/${ruta}`, {
    method: "POST",
    signal: senal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proveedor: credenciales.proveedor,
      clave_api: credenciales.clave,
      modelo: credenciales.modelo,
    }),
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok)
    throw new Error(
      datos?.detalle ??
        "No se pudo conectar. Comprueba que el servidor esté disponible.",
    );
  return datos;
}

export interface ResultadoComprobacionClave {
  clave: string;
  valida: boolean;
  detalle: string;
}

export async function comprobarLoteClaves(
  proveedor: string,
  claves: string[],
  modelo: string,
  senal?: AbortSignal,
): Promise<ResultadoComprobacionClave[]> {
  const respuesta = await fetch("/api/configuracion/comprobar-lote", {
    method: "POST",
    signal: senal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proveedor,
      claves_api: claves,
      modelo,
    }),
  });
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(
      datos?.detalle ?? "No se pudo realizar la comprobación en lote.",
    );
  }
  return datos.resultados ?? [];
}

export interface TarifasOficiales {
  proveedor: string;
  modelo: string;
  tarifa_entrada: string;
  tarifa_salida: string;
  moneda: string;
  unidad: string;
  fuente: string;
}

export async function consultarTarifasOficiales(
  proveedor: string,
  modelo: string,
  senal?: AbortSignal,
): Promise<TarifasOficiales> {
  const respuesta = await fetch(
    `/api/configuracion/tarifas-oficiales?proveedor=${encodeURIComponent(proveedor)}&modelo=${encodeURIComponent(modelo)}`,
    {
      method: "GET",
      signal: senal,
    },
  );
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(
      datos?.detalle ?? "No se pudieron obtener las tarifas oficiales.",
    );
  }
  return datos;
}
