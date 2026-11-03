import { useEffect as usarEfecto, useRef as usarReferencia } from "react";

export function usarPanelMovil(abierto: boolean, cerrar: () => void) {
  const panel = usarReferencia<HTMLElement>(null);
  usarEfecto(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const desbordamiento = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elementos = () =>
      panel.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], input:not(:disabled)",
      );
    elementos()?.[0]?.focus();
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrar();
        return;
      }
      if (evento.key !== "Tab") return;
      const controles = elementos();
      if (!controles?.length) return;
      const primero = controles[0],
        ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      }
      if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", teclado);
    return () => {
      document.removeEventListener("keydown", teclado);
      document.body.style.overflow = desbordamiento;
      anterior?.focus();
    };
  }, [abierto, cerrar]);
  return panel;
}
