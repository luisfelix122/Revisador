import { useEffect as usarEfecto, useState as usarEstado } from "react";

export function TiempoRestante({ fechaCierre }: { fechaCierre?: string | null }) {
  const [ahora, cambiarAhora] = usarEstado(() => Date.now());
  const cierre = fechaCierre ? Date.parse(fechaCierre) : NaN;

  usarEfecto(() => {
    if (!Number.isFinite(cierre)) return;
    cambiarAhora(Date.now());
    const intervalo = window.setInterval(() => cambiarAhora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, [cierre]);

  if (!Number.isFinite(cierre)) return null;
  const segundos = Math.max(0, Math.ceil((cierre - ahora) / 1000));
  if (!segundos) return <p>Tiempo estimado agotado. Actualiza el estado de recepción.</p>;

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;
  const tiempo = [minutos, resto].map((valor) => String(valor).padStart(2, "0")).join(":");
  return <p>Tiempo restante estimado: {horas ? `${horas}:${tiempo}` : tiempo}</p>;
}
