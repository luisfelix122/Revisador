import type { SupabaseClient as ClienteSupabase } from "@supabase/supabase-js";

export class ServicioBiblioteca {
  constructor(private cliente: ClienteSupabase) {}
  async solicitar(ruta: string, opciones: RequestInit = {}) {
    const {
      data: { session: sesion },
    } = await this.cliente.auth.getSession();
    if (!sesion) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
    const respuesta = await fetch("/api" + ruta, {
      ...opciones,
      signal: opciones.signal ?? AbortSignal.timeout(290000),
      headers: {
        ...(opciones.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        Authorization: "Bearer " + sesion.access_token,
        ...opciones.headers,
      },
    });
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => null);
      throw new Error(
        datos?.detalle ??
          datos?.detail ??
          "No se pudo completar la solicitud. Inténtalo otra vez.",
      );
    }
    return respuesta;
  }
  async datos<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
    return (await this.solicitar(ruta, opciones)).json();
  }
  biblioteca() {
    return this.datos<Anio[]>("/biblioteca");
  }
  crearNodo(nivel: string, nombre: string, padre_id?: string) {
    return this.datos("/biblioteca/" + nivel, {
      method: "POST",
      body: JSON.stringify({ nombre, padre_id }),
    });
  }
  crearEvaluacion(datos: object) {
    return this.datos<{ id: string }>("/evaluaciones", {
      method: "POST",
      body: JSON.stringify(datos),
    });
  }
  evaluacion(id: string) {
    return this.datos<EvaluacionDetalle>("/evaluaciones/" + id);
  }
  async subir(id: string, tipo: string, archivo: File) {
    const formulario = new FormData();
    formulario.append("archivo", archivo);
    await this.solicitar(`/evaluaciones/${id}/archivos/${tipo}`, {
      method: "POST",
      body: formulario,
    });
  }
}

export interface Pregunta {
  numero_pregunta: number;
  puntaje_maximo: number;
  respuesta_esperada: string;
}
export interface PreguntaResultado {
  numero_pregunta: number;
  puntaje_obtenido: number;
  puntaje_maximo: number;
  respuesta_detectada: string;
  justificacion: string;
}
export interface Examen {
  id: string;
  nombre_estudiante: string;
  codigo_estudiante: string;
  nota_final: number;
  observaciones_generales: string;
  estado_revision: string;
  revisado_por_profesor: boolean;
  detalles_preguntas: PreguntaResultado[];
}
export interface Archivo {
  id: string;
  nombre_archivo?: string;
  tipo_archivo: string;
  cantidad_paginas: number;
}
export interface EvaluacionDetalle {
  id: string;
  titulo: string;
  indicaciones_profesor: string;
  puntaje_total_maximo: number;
  estado: string;
  criterios_preguntas: Pregunta[];
  soluciones_profesor: Archivo[];
  materiales_apoyo: Archivo[];
  examenes_estudiantes: Examen[];
  cursos: Curso;
}
export interface EvaluacionLista {
  id: string;
  titulo: string;
  creado_en: string;
  estado: string;
  examenes_estudiantes: Pick<Examen, "id" | "nota_final" | "estado_revision">[];
}
export interface Curso {
  id: string;
  nombre: string;
  evaluaciones: EvaluacionLista[];
}
export interface Ciclo {
  id: string;
  denominacion: string;
  cursos: Curso[];
}
export interface Escuela {
  id: string;
  nombre: string;
  promociones_ciclos: Ciclo[];
}
export interface Facultad {
  id: string;
  nombre: string;
  escuelas: Escuela[];
}
export interface Anio {
  id: string;
  anio: number;
  facultades: Facultad[];
}
