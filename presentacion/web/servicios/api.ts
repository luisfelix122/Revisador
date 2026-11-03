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
