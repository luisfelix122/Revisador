import { render as representar, screen as pantalla } from "@testing-library/react";
import usuario from "@testing-library/user-event";
import { expect as esperar, test as prueba, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Acceso } from "../componentes/Acceso";

prueba("el carrusel presenta funciones y permite recorrerlas sin perder el formulario", async () => {
  representar(<Acceso cliente={{} as SupabaseClient} />);
  esperar(pantalla.getByRole("heading", {name: "Tus cursos, en orden"})).toBeInTheDocument();
  await usuario.type(pantalla.getByLabelText("Correo electrónico"), "docente@ejemplo.com");
  await usuario.click(pantalla.getByRole("button", {name: "Siguiente función"}));
  esperar(pantalla.getByRole("heading", {name: "Recibe las entregas a tu manera"})).toBeInTheDocument();
  esperar(pantalla.getByLabelText("Correo electrónico")).toHaveValue("docente@ejemplo.com");
  await usuario.click(pantalla.getByRole("button", {name: "Función anterior"}));
  esperar(pantalla.getByRole("heading", {name: "Tus cursos, en orden"})).toBeInTheDocument();
});


prueba("el formulario mantiene el inicio de sesión y la creación de cuenta", async () => {
  const iniciar = vi.fn().mockResolvedValue({data: {session: {}}, error: null});
  const registrar = vi.fn().mockResolvedValue({data: {session: null}, error: null});
  const cliente = {auth: {signInWithPassword: iniciar, signUp: registrar}} as unknown as SupabaseClient;
  representar(<Acceso cliente={cliente} />);
  await usuario.type(pantalla.getByLabelText("Correo electrónico"), "docente@ejemplo.com");
  await usuario.type(pantalla.getByLabelText("Contraseña"), "clave1234");
  await usuario.click(pantalla.getByRole("button", {name: "Iniciar sesión"}));
  esperar(iniciar).toHaveBeenCalledWith({email: "docente@ejemplo.com", password: "clave1234"});
  await usuario.click(pantalla.getByRole("button", {name: "Crear una cuenta"}));
  esperar(pantalla.getByRole("heading", {name: "Crea tu cuenta docente"})).toBeInTheDocument();
  await usuario.click(pantalla.getByRole("button", {name: "Crear cuenta"}));
  esperar(registrar).toHaveBeenCalledOnce();
  esperar(await pantalla.findByRole("status")).toHaveTextContent("Confirma el enlace del correo");
});
