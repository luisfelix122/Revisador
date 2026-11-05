import { render as representar, screen as pantalla, fireEvent as disparar } from "@testing-library/react";
import { test as prueba, expect as esperar, vi as simular } from "vitest";
import { Configuracion } from "../componentes/Configuracion";
import { guardarCredenciales, leerCredenciales } from "../servicios/credenciales";
import { comprobarLoteClaves, consultarTarifasOficiales } from "../servicios/api";

prueba("permite añadir múltiples claves de API y sincronizarlas en almacenamiento local o sesión", async () => {
  sessionStorage.clear();
  guardarCredenciales(
    {
      proveedor: "gemini",
      clave: "clave-principal",
      claves: ["clave-principal", "clave-respaldo-1"],
      modelo: "gemini-3.8-flash",
    },
    false,
  );

  representar(<Configuracion cerrar={() => {}} />);
  esperar(pantalla.getByDisplayValue("clave-principal")).toBeInTheDocument();
  esperar(pantalla.getByDisplayValue("clave-respaldo-1")).toBeInTheDocument();

  // Añadir otra clave
  disparar.click(pantalla.getByRole("button", { name: /Añadir otra clave API/i }));
  const inputs = pantalla.getAllByPlaceholderText(/Introduce clave de respaldo/i);
  esperar(inputs.length).toBe(2);

  disparar.change(inputs[1], { target: { value: "clave-respaldo-2" } });
  const { credenciales } = leerCredenciales();
  esperar(credenciales.claves).toContain("clave-respaldo-2");
});

prueba("comprobarLoteClaves envía las claves y modelo a la API y devuelve estados", async () => {
  const fetchEspia = simular.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        resultados: [
          { clave: "c1", valida: true, detalle: "OK" },
          { clave: "c2", valida: false, detalle: "Cuota agotada" },
        ],
      }),
      { status: 200 },
    ),
  );

  try {
    const res = await comprobarLoteClaves("gemini", ["c1", "c2"], "gemini-3.8-flash");
    esperar(res).toHaveLength(2);
    esperar(res[0].valida).toBe(true);
    esperar(res[1].valida).toBe(false);
  } finally {
    fetchEspia.mockRestore();
  }
});

prueba("consultarTarifasOficiales extrae las tarifas oficiales de Google Gemini", async () => {
  const fetchEspia = simular.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        proveedor: "gemini",
        modelo: "gemini-3.8-flash",
        tarifa_entrada: "0.75",
        tarifa_salida: "3.75",
        fuente: "https://ai.google.dev/pricing",
      }),
      { status: 200 },
    ),
  );

  try {
    const tarifas = await consultarTarifasOficiales("gemini", "gemini-3.8-flash");
    esperar(tarifas.tarifa_entrada).toBe("0.75");
    esperar(tarifas.tarifa_salida).toBe("3.75");
    esperar(tarifas.fuente).toContain("ai.google.dev/pricing");
  } finally {
    fetchEspia.mockRestore();
  }
});
