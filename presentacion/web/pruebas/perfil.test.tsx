import { render as representar, screen as pantalla } from "@testing-library/react";
import usuario from "@testing-library/user-event";
import { expect as esperar, test as prueba, vi } from "vitest";
import { Aplicacion } from "../Aplicacion";

prueba("el avatar abre opciones de cuenta sin cerrar la sesión", async () => {
  const salir = vi.fn();
  representar(<Aplicacion alCerrarSesion={salir} nombrePerfil="Luis" correoPerfil="luis@ejemplo.com" alGuardarPerfil={vi.fn()} />);
  await usuario.click(pantalla.getByRole("button", {name: "Cuenta de Luis"}));
  esperar(salir).not.toHaveBeenCalled();
  esperar(pantalla.getByText("luis@ejemplo.com")).toBeInTheDocument();
  esperar(pantalla.getByRole("button", {name: "Editar perfil"})).toBeInTheDocument();
  await usuario.click(pantalla.getByRole("button", {name: "Cerrar sesión"}));
  esperar(salir).toHaveBeenCalledOnce();
});

prueba("permite modificar el nombre y conserva el correo de la cuenta", async () => {
  const guardar = vi.fn().mockResolvedValue(undefined);
  representar(<Aplicacion nombrePerfil="Luis" correoPerfil="luis@ejemplo.com" alGuardarPerfil={guardar} alCerrarSesion={vi.fn()} />);
  await usuario.click(pantalla.getByRole("button", {name: "Cuenta de Luis"}));
  await usuario.click(pantalla.getByRole("button", {name: "Editar perfil"}));
  const nombre = pantalla.getByLabelText("Nombre para mostrar");
  await usuario.clear(nombre);
  await usuario.type(nombre, "  Luis Pérez  ");
  esperar(pantalla.getByLabelText("Correo de la cuenta")).toHaveAttribute("readonly");
  await usuario.click(pantalla.getByRole("button", {name: "Guardar cambios"}));
  esperar(guardar).toHaveBeenCalledWith("Luis Pérez");
  esperar(await pantalla.findByText("Tu perfil se actualizó correctamente.")).toBeInTheDocument();
});

prueba("informa si no se pudo guardar el perfil", async () => {
  representar(<Aplicacion nombrePerfil="Luis" correoPerfil="luis@ejemplo.com" alGuardarPerfil={vi.fn().mockRejectedValue(new Error("fallo"))} />);
  await usuario.click(pantalla.getByRole("button", {name: "Cuenta de Luis"}));
  await usuario.click(pantalla.getByRole("button", {name: "Editar perfil"}));
  await usuario.click(pantalla.getByRole("button", {name: "Guardar cambios"}));
  esperar(await pantalla.findByRole("alert")).toHaveTextContent("No se pudo guardar tu perfil");
});
