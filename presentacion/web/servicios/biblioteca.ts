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
  eliminarNodo(nivel: string, id: string) {
    return this.datos(`/biblioteca/${nivel}/${id}`, { method: 'DELETE' });
  }
  renombrarNodo(nivel: string, id: string, nombre: string) {
    return this.datos(`/biblioteca/${nivel}/${id}`, { method: "PATCH", body: JSON.stringify({ nombre }) });
  }
  renombrarEvaluacion(id: string, nombre: string) {
    return this.datos(`/evaluaciones/${id}`, { method: "PATCH", body: JSON.stringify({ nombre }) });
  }
  eliminarEvaluacion(id: string) {
    return this.datos(`/evaluaciones/${id}`, { method: "DELETE" });
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
  async subirExamenFotos(id: string, formulario: FormData) {
    await this.solicitar(`/evaluaciones/${id}/archivos-examen-fotos`, { method: "POST", body: formulario });
  }
  configurarRecepcion(
    evaluacionId: string,
    abierta: boolean,
    tiempoMinutos: number | null = null,
    permitirGlobal = false,
    estudiantesEsperados: number | null = null,
  ) {
    return this.datos(`/evaluaciones/${evaluacionId}/recepcion/estado`, {
      method: "PUT",
      body: JSON.stringify({
        abierta,
        tiempo_minutos: tiempoMinutos,
        permitir_reenvios_global: permitirGlobal,
        estudiantes_esperados: estudiantesEsperados,
      }),
    });
  }
  configurarModalidad(evaluacionId: string, modalidad: "alumnos" | "manual", finalizada?: boolean) {
    return this.datos(`/evaluaciones/${evaluacionId}/recepcion/modalidad`, {
      method: "PUT", body: JSON.stringify({ modalidad, finalizada: finalizada ?? null }),
    });
  }
  configurarPuntajeAprobatorio(evaluacionId: string, puntaje: number) {
    return this.datos(`/evaluaciones/${evaluacionId}/puntaje-aprobatorio`, { method: "PUT", body: JSON.stringify({ puntaje }) });
  }
  permitirReenvioAlumno(evaluacionId: string, examenId: string, permitir: boolean) {
    return this.datos(`/evaluaciones/${evaluacionId}/examenes/${examenId}/permitir-reenvio`, {
      method: "PUT",
      body: JSON.stringify({ permitir }),
    });
  }
  historialAlumno(evaluacionId: string, examenId: string) {
    return this.datos<{ examen_id: string; historial: HistorialEntrega[] }>(
      `/evaluaciones/${evaluacionId}/examenes/${examenId}/historial`
    );
  }
  reiniciarExamen(evaluacionId: string, examenId: string) {
    return this.datos(`/evaluaciones/${evaluacionId}/examenes/${examenId}/reiniciar`, {
      method: "POST",
    });
  }
  async obtenerArchivoExamenUrl(evaluacionId: string, examenId: string, ruta?: string): Promise<string> {
    const sufijo = ruta ? `?ruta=${encodeURIComponent(ruta)}` : "";
    const respuesta = await this.solicitar(`/evaluaciones/${evaluacionId}/examenes/${examenId}/archivo${sufijo}`);
    const blob = await respuesta.blob();
    return URL.createObjectURL(blob);
  }
}

export interface HistorialEntrega {
  id: string;
  numero_entrega: number;
  ruta_archivo: string;
  creado_en: string;
  motivo_reenvio?: string;
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
  ruta_imagen_examen?: string;
  numero_entregas?: number;
  permitir_reenvio?: boolean;
  detalles_preguntas: PreguntaResultado[];
  historial_entregas_estudiantes?: HistorialEntrega[];
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
  puntaje_aprobatorio?: number;
  estado: string;
  modalidad_recepcion?: "alumnos" | "manual";
  recepcion_iniciada?: boolean;
  carga_manual_finalizada?: boolean;
  token_recepcion?: string;
  recepcion_abierta?: boolean;
  tiempo_limite_minutos?: number | null;
  fecha_cierre_programada?: string | null;
  permitir_reenvios_global?: boolean;
  cantidad_estudiantes_esperados?: number | null;
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
  eliminando?: boolean;
  examenes_estudiantes: Pick<Examen, "id" | "nota_final" | "estado_revision">[];
}
export interface Curso {
  id: string;
  nombre: string;
  evaluaciones: EvaluacionLista[];
  promociones_ciclos?: {
    id: string;
    denominacion: string;
    escuelas?: {
      id: string;
      nombre: string;
      facultades?: {
        id: string;
        nombre: string;
        anios_academicos?: {
          id: string;
          anio: number;
        };
      };
    };
  };
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
