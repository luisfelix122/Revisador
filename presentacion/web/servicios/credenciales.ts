import type { Credenciales } from "../tipos";

const nombre = "revisador.ia";

export function leerCredenciales(): {
  credenciales: Credenciales;
  recordar: boolean;
} {
  const vacias: Credenciales = { proveedor: "gemini", clave: "", modelo: "" };
  try {
    const local = localStorage.getItem(nombre);
    const guardadas = JSON.parse(
      sessionStorage.getItem(nombre) ?? local ?? "null",
    );
    if (
      !guardadas ||
      !["openai", "gemini"].includes(guardadas.proveedor) ||
      typeof guardadas.clave !== "string" ||
      typeof guardadas.modelo !== "string"
    )
      return { credenciales: vacias, recordar: false };
    const claves = Array.isArray(guardadas.claves)
      ? guardadas.claves.filter((c: unknown) => typeof c === "string")
      : [guardadas.clave].filter(Boolean);
    return {
      credenciales: {
        proveedor: guardadas.proveedor,
        clave: guardadas.clave,
        claves: claves.length ? claves : [guardadas.clave].filter(Boolean),
        modelo: guardadas.modelo,
      },
      recordar: Boolean(local),
    };
  } catch {
    return { credenciales: vacias, recordar: false };
  }
}

export function guardarCredenciales(
  credenciales: Credenciales,
  recordar: boolean,
) {
  sessionStorage.setItem(nombre, JSON.stringify(credenciales));
  if (recordar) {
    localStorage.setItem(nombre, JSON.stringify(credenciales));
    return;
  }
  localStorage.removeItem(nombre);
}
