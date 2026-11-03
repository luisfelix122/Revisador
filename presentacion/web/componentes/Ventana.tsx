import {
  useEffect as usarEfecto,
  useRef as usarReferencia,
  type ReactNode as Contenido,
} from "react";
import { X as Cerrar } from "lucide-react";

export function Ventana({
  titulo,
  cerrar,
  children: contenido,
}: {
  titulo: string;
  cerrar: () => void;
  children: Contenido;
}) {
  const panel = usarReferencia<HTMLDivElement>(null);
  usarEfecto(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const desbordamiento = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current
      ?.querySelector<HTMLElement>("button, input, select, textarea")
      ?.focus();
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
      if (evento.key !== "Tab") return;
      const elementos = panel.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
      );
      if (!elementos?.length) return;
      const primero = elementos[0],
        ultimo = elementos[elementos.length - 1];
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
  }, [cerrar]);
  return (
    <div
      className="velo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="ventana"
      >
        <div className="cabecera-ventana">
          <h2>{titulo}</h2>
          <button
            className="boton-icono"
            onClick={cerrar}
            aria-label="Cerrar ventana"
          >
            <Cerrar size={21} />
          </button>
        </div>
        {contenido}
      </div>
    </div>
  );
}
