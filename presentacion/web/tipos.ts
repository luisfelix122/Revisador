export interface NodoAcademico {
  id: string;
  nombre: string;
  hijos?: NodoAcademico[];
}
export interface EvaluacionResumen {
  id: string;
  titulo: string;
  curso: string;
  fecha: string;
  cantidadExamenes: number;
  promedio?: number;
  estado: "borrador" | "calificado";
}
export interface Credenciales {
  proveedor: "openai" | "gemini";
  clave: string;
  claves?: string[];
  modelo: string;
}
