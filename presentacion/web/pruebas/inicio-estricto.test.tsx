import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Revisador } from "../Revisador";

test("el inicio en modo estricto no crea clientes de autenticación duplicados", async () => {
  const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
  const peticion = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
    new Response(JSON.stringify({ supabase_url: "https://estricto.supabase.co", clave_publicable: "publicable-prueba" }), { status: 200 })),
  );
  try {
    render(<StrictMode><Revisador /></StrictMode>);
    await screen.findByRole("heading", { name: "Bienvenido a Revisador" });
    expect(aviso.mock.calls.flat().join(" ")).not.toContain("Multiple GoTrueClient instances");
  } finally {
    aviso.mockRestore();
    peticion.mockRestore();
  }
});

