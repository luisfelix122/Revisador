import { render as representar, screen as pantalla } from "@testing-library/react";
import { test as prueba, expect as esperar } from "vitest";
import { Configuracion } from "../componentes/Configuracion";
import { guardarCredenciales } from "../servicios/credenciales";

prueba("muestra el modelo guardado al volver a abrir configuración", () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave-prueba",modelo:"modelo-prueba"},false);
  representar(<Configuracion cerrar={()=>{}} />);
  esperar(pantalla.getByLabelText("Modelo")).toHaveValue("modelo-prueba");
  esperar(pantalla.getByRole("option",{name:/modelo-prueba/})).toBeInTheDocument();
});
