import { useState as usarEstado } from "react";
import {
  ChevronRight as Flecha,
  Folder as Carpeta,
  BookOpen as Libro,
  ArrowLeft as Regresar,
  Plus as Agregar,
} from "lucide-react";
import type { NodoAcademico } from "../tipos";

interface Propiedades {
  nodos: NodoAcademico[];
  activo?: string;
  alSeleccionar?: (id: string) => void;
  alRegresar?: () => void;
  alOrganizar?: () => void;
}

function Rama({
  nodo,
  activo,
  alSeleccionar,
}: {
  nodo: NodoAcademico;
  activo?: string;
  alSeleccionar?: (id: string) => void;
}) {
  const [abierto, abrir] = usarEstado(false);
  return (
    <li>
      <div className={`rama ${activo === nodo.id ? "seleccionada" : ""}`}>
        {nodo.hijos?.length ? (
          <button
            className="desplegar"
            aria-label={`${abierto ? "Contraer" : "Expandir"} ${nodo.nombre}`}
            aria-expanded={abierto}
            onClick={() => abrir(!abierto)}
          >
            <Flecha size={15} className={abierto ? "girada" : ""} />
          </button>
        ) : (
          <span className="espacio-rama" />
        )}
        <button
          className="nombre-rama"
          onClick={() => alSeleccionar?.(nodo.id)}
        >
          {nodo.hijos ? <Carpeta size={17} /> : <Libro size={17} />}
          <span>{nodo.nombre}</span>
        </button>
      </div>
      {abierto && nodo.hijos && (
        <ul className="ramas-hijas">
          {nodo.hijos.map((hijo) => (
            <Rama
              key={hijo.id}
              nodo={hijo}
              activo={activo}
              alSeleccionar={alSeleccionar}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Explorador({
  nodos,
  activo,
  alSeleccionar,
  alRegresar,
  alOrganizar,
}: Propiedades) {
  return (
    <section className="explorador" aria-label="Explorador académico">
      <div className="titulo-explorador">
        <h2>Biblioteca académica</h2>
        <div style={{ display: "flex", gap: "4px" }}>
          {alOrganizar && (
            <button
              className="boton-icono pequeno"
              onClick={alOrganizar}
              title="Organizar y agregar cursos"
              aria-label="Organizar y agregar cursos"
            >
              <Agregar size={17} />
            </button>
          )}
          {alRegresar && (
            <button
              className="boton-icono pequeno"
              onClick={alRegresar}
              aria-label="Regresar"
            >
              <Regresar size={17} />
            </button>
          )}
        </div>
      </div>
      {nodos.length ? (
        <ul className="arbol">
          {nodos.map((nodo) => (
            <Rama
              key={nodo.id}
              nodo={nodo}
              activo={activo}
              alSeleccionar={alSeleccionar}
            />
          ))}
        </ul>
      ) : (
        <div className="arbol-vacio">
          <Carpeta size={24} />
          <p>
            Tu estructura académica
            <br />
            aparecerá aquí.
          </p>
          <span>
            Año · Facultad · Escuela
            <br />
            Ciclo · Curso
          </span>
          {alOrganizar && (
            <button
              type="button"
              className="boton-primario pequeno"
              style={{ marginTop: "14px", width: "100%", justifyContent: "center" }}
              onClick={alOrganizar}
            >
              <Agregar size={15} /> Organizar cursos
            </button>
          )}
        </div>
      )}
    </section>
  );
}
