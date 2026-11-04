import { render, waitFor } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import { Revisador } from "../Revisador";

const dobles = vi.hoisted(() => ({ crear: vi.fn(), suscribir: vi.fn(), sesion: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: dobles.crear }));

test("no suscribe la sesión si se desmonta mientras se consulta", async () => {
  let resolver!: (valor: unknown) => void;
  dobles.sesion.mockReturnValue(new Promise((r) => { resolver = r; }));
  dobles.crear.mockReturnValue({ auth: { getSession: dobles.sesion, onAuthStateChange: dobles.suscribir } });
  dobles.suscribir.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  const peticion = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({supabase_url:"https://prueba.test",clave_publicable:"prueba"})));
  try {
    const vista = render(<Revisador />);
    await waitFor(() => expect(dobles.sesion).toHaveBeenCalled());
    vista.unmount();
    resolver({ data: { session: null } });
    await new Promise((r) => setTimeout(r, 0));
    expect(dobles.suscribir).not.toHaveBeenCalled();
  } finally { peticion.mockRestore(); }
});
