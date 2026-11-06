import { useState as usarEstado } from "react";
import {
  ChevronRight as Flecha,
  Folder as Carpeta,
  BookOpen as Libro,
  ArrowLeft as Regresar,
  Plus as Agregar,
  Trash2 as Eliminar,
  Pencil as Editar,
} from "lucide-react";
import type { NodoAcademico } from "../tipos";

interface Propiedades {
  nodos: NodoAcademico[];
  activo?: string;
  alSeleccionar?: (id: string) => void;
  alRegresar?: () => void;
  alOrganizar?: () => void;
  alEliminar?: (tipo: NonNullable<NodoAcademico['tipo']>, id: string, nombre: string) => void;
  alRenombrar?: (tipo: NonNullable<NodoAcademico['tipo']>, id: string, nombre: string) => void;
}

function Rama({
  nodo,
  activo,
  alSeleccionar,
  alEliminar,
  alRenombrar,
}: {
  nodo: NodoAcademico;
  activo?: string;
  alSeleccionar?: (id: string) => void;
  alEliminar?: Propiedades['alEliminar'];
  alRenombrar?: Propiedades['alRenombrar'];
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
        {nodo.tipo && alRenombrar && <button type="button" className="boton-icono pequeno" aria-label={`Renombrar ${nodo.nombre}`} title="Renombrar" onClick={() => alRenombrar(nodo.tipo!, nodo.id, nodo.nombre)}><Editar size={15} /></button>}
        {nodo.tipo && alEliminar && <button type="button" className="boton-icono pequeno accion-eliminar" aria-label={`Eliminar ${nodo.nombre}`} title="Eliminar si está vacío" onClick={() => alEliminar(nodo.tipo!, nodo.id, nodo.nombre)}><Eliminar size={15} /></button>}
      </div>
      {abierto && nodo.hijos && (
        <ul className="ramas-hijas">
          {nodo.hijos.map((hijo) => (
            <Rama
              key={hijo.id}
              nodo={hijo}
              activo={activo}
              alSeleccionar={alSeleccionar}
              alEliminar={alEliminar}
              alRenombrar={alRenombrar}
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
  alEliminar,
  alRenombrar,
}: Propiedades) {
  return (
    <section className="explorador" aria-label="Explorador académico">
      <div className="titulo-explorador">
        <h2>Biblioteca académica</h2>
        <div style={{ display: "flex", gap: "4px" }}>
          {alOrganizar && nodos.length > 0 && (
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
              alEliminar={alEliminar}
              alRenombrar={alRenombrar}
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
