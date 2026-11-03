import { useState as usarEstado } from "react";
import type { SupabaseClient as ClienteSupabase } from "@supabase/supabase-js";
import { ShieldCheck as Escudo } from "lucide-react";

export function Acceso({ cliente }: { cliente: ClienteSupabase }) {
  const [registro, cambiarRegistro] = usarEstado(false);
  const [correo, cambiarCorreo] = usarEstado("");
  const [contrasena, cambiarContrasena] = usarEstado("");
  const [ocupado, ocupar] = usarEstado(false);
  const [error, mostrarError] = usarEstado("");
  const [mensaje, mostrarMensaje] = usarEstado("");
  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    ocupar(true);
    mostrarError("");
    mostrarMensaje("");
    try {
      const resultado = registro
        ? await cliente.auth.signUp({
            email: correo.trim(),
            password: contrasena,
            options: { emailRedirectTo: window.location.origin },
          })
        : await cliente.auth.signInWithPassword({
            email: correo.trim(),
            password: contrasena,
          });
      if (resultado.error)
        throw new Error(
          registro
            ? "No se pudo crear la cuenta. Revisa el correo y usa una contraseña segura; si ya tienes cuenta, inicia sesión."
            : "No se pudo iniciar sesión. Revisa tus datos y confirma tu correo.",
        );
      if (registro && !resultado.data.session) {
        mostrarMensaje(
          "Confirma el enlace del correo; después vuelve a esta página e inicia sesión. Revisa también correo no deseado.",
        );
        cambiarRegistro(false);
        cambiarContrasena("");
      }
    } catch (problema) {
      mostrarError(
        problema instanceof Error
          ? problema.message
          : "No se pudo conectar. Inténtalo otra vez.",
      );
    } finally {
      ocupar(false);
    }
  };
  return (
    <div className="pantalla-acceso">
      <header className="barra-acceso">
        <strong>Revisador</strong>
        <span>Tu espacio docente</span>
      </header>
      <main className="acceso">
        <Escudo size={32} className="azul" />
        <h1>
          {registro ? "Crea tu cuenta docente" : "Bienvenido a Revisador"}
        </h1>
        <p>
          Organiza tus evaluaciones y corrige con tus propios criterios. Tus
          archivos solo son accesibles desde tu cuenta.
        </p>
        <form onSubmit={enviar}>
          <label>
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="email"
              value={correo}
              onChange={(evento) => cambiarCorreo(evento.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              minLength={8}
              required
              autoComplete={registro ? "new-password" : "current-password"}
              value={contrasena}
              onChange={(evento) => cambiarContrasena(evento.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {mensaje && (
            <p role="status" className="exito">
              {mensaje}
            </p>
          )}
          <button className="boton-primario" disabled={ocupado}>
            {ocupado
              ? "Conectando…"
              : registro
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </button>
        </form>
        <button
          className="boton-texto"
          onClick={() => {
            cambiarRegistro(!registro);
            mostrarError("");
            mostrarMensaje("");
          }}
        >
          {registro ? "Ya tengo cuenta" : "Crear una cuenta"}
        </button>
        <p className="ayuda-campo">
          Tu clave de IA se configura después y no se guarda en nuestra base de
          datos.
        </p>
      </main>
    </div>
  );
}
