import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle as Alerta, RotateCcw as Recargar } from "lucide-react";

interface Propiedades {
  children: ReactNode;
  alRecuperar?: () => void;
}

interface Estado {
  tieneError: boolean;
  error?: Error;
}

export class LimiteDeError extends Component<Propiedades, Estado> {
  constructor(props: Propiedades) {
    super(props);
    this.state = { tieneError: false };
  }

  static getDerivedStateFromError(error: Error): Estado {
    return { tieneError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error capturado por LimiteDeError:", error, info);
  }

  recuperar = () => {
    this.setState({ tieneError: false, error: undefined });
    this.props.alRecuperar?.();
    window.location.reload();
  };

  render() {
    if (this.state.tieneError) {
      return (
        <div
          className="pantalla-acceso"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeContent: "center",
            padding: "24px",
            background: "#f8f9fa",
          }}
        >
          <div
            style={{
              maxWidth: "460px",
              margin: "0 auto",
              background: "#fff",
              borderRadius: "12px",
              padding: "36px 28px",
              boxShadow: "0 4px 24px rgba(32,33,36,0.1)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#fce8e6",
                display: "grid",
                placeContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <Alerta size={30} color="#c5221f" />
            </div>
            <h1
              style={{
                fontSize: "19px",
                fontWeight: 600,
                color: "#202124",
                marginBottom: "8px",
              }}
            >
              Ocurrió un problema al mostrar la biblioteca
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#5f6368",
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              Tus cursos y datos están seguros en la nube. Haz clic en el botón
              para recargar y recuperar la visualización.
            </p>
            <button
              type="button"
              className="boton-primario"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                margin: "0 auto",
                padding: "10px 20px",
              }}
              onClick={this.recuperar}
            >
              <Recargar size={17} />
              Recargar biblioteca
            </button>
            {this.state.error && (
              <details style={{ marginTop: "20px", textAlign: "left" }}>
                <summary
                  style={{
                    fontSize: "12px",
                    color: "#5f6368",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Ver detalle técnico del error
                </summary>
                <pre
                  style={{
                    marginTop: "8px",
                    padding: "10px",
                    background: "#f1f3f4",
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: "#b3261e",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {this.state.error.name}: {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
