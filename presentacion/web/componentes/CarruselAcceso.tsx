import { useState as usarEstado } from "react";
import {
  ArrowLeft as Anterior, ArrowRight as Siguiente, BookOpen as Libro,
  Folder as Carpeta, FileText as Archivo, Link2 as Enlace,
  ListChecks as Lista, CheckCircle2 as Confirmado, Sparkles as Destello,
  FileSpreadsheet as Hoja, Upload as Subir, type LucideIcon as Icono,
} from "lucide-react";

interface Funcionalidad {
  titulo: string;
  descripcion: string;
  etiqueta: string;
  icono: Icono;
  filas: { icono: Icono; nombre: string; detalle: string }[];
}

const funcionalidades: Funcionalidad[] = [
  {
    titulo: "Tus cursos, en orden",
    descripcion: "Organiza tus evaluaciones por año, facultad, escuela, ciclo y curso. Todo tu trabajo, en un mismo lugar.",
    etiqueta: "Tu biblioteca académica",
    icono: Libro,
    filas: [
      { icono: Carpeta, nombre: "Año académico", detalle: "Organiza por periodo" },
      { icono: Carpeta, nombre: "Facultad y escuela", detalle: "Construye tu estructura" },
      { icono: Libro, nombre: "Ciclo y curso", detalle: "Encuentra tus evaluaciones" },
    ],
  },
  {
    titulo: "Recibe las entregas a tu manera",
    descripcion: "Comparte un enlace con tus estudiantes o carga sus exámenes tú mismo. Elige lo que mejor funcione en tu clase.",
    etiqueta: "Recepción de exámenes",
    icono: Enlace,
    filas: [
      { icono: Enlace, nombre: "Enlace para estudiantes", detalle: "Comparte la recepción" },
      { icono: Subir, nombre: "Carga docente", detalle: "Añade los archivos manualmente" },
      { icono: Confirmado, nombre: "Control de recepción", detalle: "Gestiona el aforo y el tiempo" },
    ],
  },
  {
    titulo: "Define cómo quieres evaluar",
    descripcion: "Añade la solución y tus materiales de apoyo. Usa la IA para preparar criterios que podrás revisar y ajustar.",
    etiqueta: "Solución y criterios",
    icono: Lista,
    filas: [
      { icono: Archivo, nombre: "Solución oficial", detalle: "El punto de partida" },
      { icono: Carpeta, nombre: "Material de apoyo", detalle: "Añade contexto a la revisión" },
      { icono: Destello, nombre: "Criterios con IA", detalle: "Revísalos antes de continuar" },
    ],
  },
  {
    titulo: "Revisa antes de decidir",
    descripcion: "Consulta el costo estimado, revisa las calificaciones y sus justificaciones, y descarga las notas en Excel.",
    etiqueta: "Revisión y resultados",
    icono: Confirmado,
    filas: [
      { icono: Lista, nombre: "Resumen del lote", detalle: "Consulta el costo estimado" },
      { icono: Confirmado, nombre: "Revisión docente", detalle: "Tu criterio tiene la última palabra" },
      { icono: Hoja, nombre: "Notas en Excel", detalle: "Descarga los resultados" },
    ],
  },
];

export function CarruselAcceso() {
  const [actual, cambiarActual] = usarEstado(0);
  const elemento = funcionalidades[actual];
  const IconoPrincipal = elemento.icono;
  const mover = (diferencia: number) => cambiarActual((indice) => (indice + diferencia + funcionalidades.length) % funcionalidades.length);
  return (
    <section className="carrusel-acceso" aria-label="Conoce las funciones de Revisador" aria-roledescription="carrusel">
      <div className="carrusel-contenido">
        <div className="carrusel-introduccion">
          <span className="carrusel-marca"><span /> HECHO PARA DOCENTES</span>
          <h2>Una forma más clara de <em>revisar.</em></h2>
          <p>Desde la organización hasta los resultados, acompaña cada paso de tus evaluaciones.</p>
        </div>
        <div className="carrusel-muestra" aria-hidden="true">
          <div className="muestra-barra"><span /><span /><span /><small>REVISADOR / {elemento.etiqueta.toUpperCase()}</small></div>
          <div className="muestra-cabecera"><span className="muestra-icono"><IconoPrincipal size={22} /></span><div><strong>{elemento.etiqueta}</strong><small>Un espacio para tu trabajo docente</small></div></div>
          <div className="muestra-filas">{elemento.filas.map((fila) => { const IconoFila = fila.icono; return <div className="muestra-fila" key={fila.nombre}><span><IconoFila size={18} /></span><div><strong>{fila.nombre}</strong><small>{fila.detalle}</small></div><Siguiente size={16} /></div>; })}</div>
          <div className="muestra-pie">Una vista de lo que puedes hacer en Revisador</div>
        </div>
        <div className="carrusel-detalle" aria-live="polite" aria-atomic="true">
          <h3>{elemento.titulo}</h3>
          <p>{elemento.descripcion}</p>
        </div>
        <div className="carrusel-controles">
          <div className="carrusel-indicadores" aria-label="Elegir función">
            {funcionalidades.map((funcionalidad, indice) => <button key={funcionalidad.titulo} type="button" aria-label={`Ver ${funcionalidad.titulo}`} aria-current={indice === actual ? "true" : undefined} onClick={() => cambiarActual(indice)} />)}
          </div>
          <div className="carrusel-flechas"><button type="button" aria-label="Función anterior" onClick={() => mover(-1)}><Anterior size={18} /></button><button type="button" aria-label="Siguiente función" onClick={() => mover(1)}><Siguiente size={18} /></button></div>
        </div>
      </div>
    </section>
  );
}
