import {
  render as representar,
  screen as pantalla,
  fireEvent as disparar,
} from "@testing-library/react";
import { test as prueba, expect as esperar, vi as simular } from "vitest";
import type { SupabaseClient as ClienteSupabase } from "@supabase/supabase-js";
import { ServicioBiblioteca } from "../servicios/biblioteca";
import { DetalleEvaluacion } from "../componentes/DetalleEvaluacion";
import { guardarCredenciales } from "../servicios/credenciales";

prueba(
  "presenta solución materiales y exámenes sin iniciar llamadas de pago",
  async () => {
    const peticion = simular.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "evaluacion",
          titulo: "Parcial de Álgebra",
          cursos: { nombre: "Álgebra" },
          puntaje_total_maximo: 20,
          indicaciones_profesor: "",
          criterios_preguntas: [],
          soluciones_profesor: [],
          materiales_apoyo: [],
          examenes_estudiantes: [],
        }),
        { status: 200 },
      ),
    );
    const cliente = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "token-prueba" } },
        }),
      },
    } as unknown as ClienteSupabase;
    try {
      representar(
        <DetalleEvaluacion
          identificador="evaluacion"
          servicio={new ServicioBiblioteca(cliente)}
          apiVerificada={false}
          alVolver={() => {}}
        />,
      );
      esperar(
        await pantalla.findByRole("heading", { name: "Parcial de Álgebra" }),
      ).toBeInTheDocument();
      esperar(pantalla.getByLabelText("Solución oficial")).toBeInTheDocument();
      esperar(
        pantalla.getByLabelText("Exámenes de estudiantes"),
      ).toBeInTheDocument();
      esperar(peticion).toHaveBeenCalledTimes(1);
    } finally {
      peticion.mockRestore();
    }
  },
);

prueba("permite corregir una respuesta detectada al revisar un examen", async () => {
  const examen = {id:"examen", nombre_estudiante:"Ana", codigo_estudiante:"01", nota_final:0, estado_revision:"completado", observaciones_generales:"", detalles_preguntas:[{numero_pregunta:1,puntaje_obtenido:0,puntaje_maximo:20,respuesta_detectada:"nada",justificacion:"Sin respuesta"}]};
  const peticion = simular.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({id:"evaluacion",titulo:"Parcial",cursos:{nombre:"Álgebra"},puntaje_total_maximo:20,indicaciones_profesor:"",criterios_preguntas:[],soluciones_profesor:[],materiales_apoyo:[],examenes_estudiantes:[examen]}),{status:200}));
  const cliente = {auth:{getSession:async()=>({data:{session:{access_token:"token-prueba"}}})}} as unknown as ClienteSupabase;
  try {
    representar(<DetalleEvaluacion identificador="evaluacion" servicio={new ServicioBiblioteca(cliente)} apiVerificada={false} alVolver={()=>{}} />);
    disparar.click(await pantalla.findByRole("button",{name:"Revisar preguntas"}));
    esperar(pantalla.getByLabelText("Respuesta detectada")).toHaveValue("nada");
  } finally { peticion.mockRestore(); }
});

prueba("no envía exámenes si cambia la configuración después de estimar", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave-a",modelo:"modelo-a"}, false);
  const evaluacion = {id:"evaluacion",titulo:"Parcial",cursos:{nombre:"Álgebra"},puntaje_total_maximo:20,indicaciones_profesor:"",criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"Respuesta"}],soluciones_profesor:[{ruta_almacenamiento:"solucion"}],materiales_apoyo:[],examenes_estudiantes:[{id:"examen",estado_revision:"pendiente"}]};
  const peticion = simular.spyOn(globalThis,"fetch").mockImplementation(async (entrada) => {
    const ruta=String(entrada);
    return new Response(JSON.stringify(ruta.endsWith('/estimar') ? {costo_usd:"1",examenes:1,paginas:1,huella:"a".repeat(64),modelo:"modelo-a",advertencia:"Estimación"} : evaluacion),{status:200});
  });
  const cliente = {auth:{getSession:async()=>({data:{session:{access_token:"token-prueba"}}})}} as unknown as ClienteSupabase;
  try {
    representar(<DetalleEvaluacion identificador="evaluacion" servicio={new ServicioBiblioteca(cliente)} apiVerificada={true} alVolver={()=>{}} />);
    await pantalla.findByRole("heading",{name:"Parcial"});
    disparar.change(pantalla.getByLabelText("Tarifa de entrada (USD / millón)"),{target:{value:"1"}});
    disparar.change(pantalla.getByLabelText("Tarifa de salida (USD / millón)"),{target:{value:"1"}});
    disparar.click(pantalla.getByRole("button",{name:"Estimar costo del lote"}));
    disparar.click(await pantalla.findByRole("checkbox",{name:/Acepto la estimación/}));
    guardarCredenciales({proveedor:"gemini",clave:"clave-b",modelo:"modelo-b"}, false);
    disparar.click(pantalla.getByRole("button",{name:"Confirmar y calificar lote"}));
    esperar(await pantalla.findByRole("alert")).toHaveTextContent(/configuración.*cambió/i);
    esperar(peticion.mock.calls.some(([ruta])=>String(ruta).includes('/calificar/'))).toBe(false);
  } finally { peticion.mockRestore(); sessionStorage.clear(); }
});
