import {
  render as representar,
  screen as pantalla,
} from "@testing-library/react";
import { expect as esperar, test as prueba, vi as simular } from "vitest";
import { Revisador } from "../Revisador";

prueba(
  "el flujo privado comienza con acceso docente y no expone evaluaciones",
  async () => {
    const peticion = simular.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          supabase_url: "https://prueba.supabase.co",
          clave_publicable: "publicable-prueba",
        }),
        { status: 200 },
      ),
    );
    try {
      representar(<Revisador />);
      esperar(
        await pantalla.findByRole("heading", {
          name: "Bienvenido a Revisador",
        }),
      ).toBeInTheDocument();
      esperar(
        pantalla.getByLabelText("Correo electrónico"),
      ).toBeInTheDocument();
      esperar(
        pantalla.queryByText("Biblioteca académica"),
      ).not.toBeInTheDocument();
    } finally {
      peticion.mockRestore();
    }
  },
);
