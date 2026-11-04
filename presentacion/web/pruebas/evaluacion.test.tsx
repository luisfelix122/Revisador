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

prueba("no envía exámenes si cambia la configuración después de preparar", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave-a",modelo:"modelo-a"}, false);
  const evaluacion = {id:"evaluacion",titulo:"Parcial",cursos:{nombre:"Álgebra"},puntaje_total_maximo:20,indicaciones_profesor:"",criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"Respuesta"}],soluciones_profesor:[{ruta_almacenamiento:"solucion"}],materiales_apoyo:[],examenes_estudiantes:[{id:"examen",estado_revision:"pendiente"}]};
  const peticion = simular.spyOn(globalThis,"fetch").mockImplementation(async (entrada) => {
    const ruta=String(entrada);
    return new Response(JSON.stringify(ruta.endsWith('/preparar') ? {examenes:1,huella:"a".repeat(64)} : evaluacion),{status:200});
  });
  const cliente = {auth:{getSession:async()=>({data:{session:{access_token:"token-prueba"}}})}} as unknown as ClienteSupabase;
  try {
    representar(<DetalleEvaluacion identificador="evaluacion" servicio={new ServicioBiblioteca(cliente)} apiVerificada={true} alVolver={()=>{}} />);
    await pantalla.findByRole("heading",{name:"Parcial"});
    esperar(pantalla.queryByText("Presupuesto y calificación del lote")).not.toBeInTheDocument();
    disparar.click(pantalla.getByRole("button",{name:"Preparar calificación"}));
    disparar.click(await pantalla.findByRole("checkbox",{name:/Autorizo el envío/}));
    guardarCredenciales({proveedor:"gemini",clave:"clave-b",modelo:"modelo-b"}, false);
    disparar.click(pantalla.getByRole("button",{name:"Confirmar y calificar lote"}));
    esperar(await pantalla.findByRole("alert")).toHaveTextContent(/configuración.*cambió/i);
    esperar(peticion.mock.calls.some(([ruta])=>String(ruta).includes('/calificar/'))).toBe(false);
  } finally { peticion.mockRestore(); sessionStorage.clear(); }
});

prueba("abre una evaluación recién creada aunque sus relaciones sean nulas", async () => {
  const servicio = { evaluacion: async () => ({ id: "pc01", titulo: "PC01", cursos: { nombre: "Curso" }, puntaje_total_maximo: 20, criterios_preguntas: null, soluciones_profesor: null, materiales_apoyo: null, examenes_estudiantes: null }) } as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc01" servicio={servicio} apiVerificada={false} alVolver={() => {}} />);
  esperar(await pantalla.findByRole("heading", { name: "PC01" })).toBeInTheDocument();
  esperar(pantalla.getByText("0/100 exámenes guardados")).toBeInTheDocument();
});

prueba("considera aprobada la nota 10,5 y desaprobada la nota inferior", async () => {
  const examen = (id: string, nota: number) => ({ id, nombre_estudiante: id, codigo_estudiante: id, nota_final: nota, estado_revision: "completado", observaciones_generales: "", detalles_preguntas: [] });
  const servicio = { evaluacion: async () => ({ id: "pc", titulo: "PC", cursos: { nombre: "Curso" }, puntaje_total_maximo: 20, criterios_preguntas: [], soluciones_profesor: [], materiales_apoyo: [], examenes_estudiantes: [examen("Ana",10.5), examen("Luis",10.49)] }) } as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={() => {}} />);
  await pantalla.findByRole("heading", { name: "PC" });
  disparar.change(pantalla.getByLabelText("Filtrar resultados"), { target: { value: "aprobados" } });
  esperar(pantalla.getAllByText("Ana")).toHaveLength(2);
  esperar(pantalla.queryByText("Luis")).not.toBeInTheDocument();
});

prueba("añade una pregunta sin repetir números existentes en la rúbrica", async () => {
  const servicio = { evaluacion: async () => ({ id: "pc", titulo: "PC", cursos: { nombre: "Curso" }, puntaje_total_maximo: 20, criterios_preguntas: [{numero_pregunta:1,puntaje_maximo:10,respuesta_esperada:"A"},{numero_pregunta:3,puntaje_maximo:10,respuesta_esperada:"B"}], soluciones_profesor: [], materiales_apoyo: [], examenes_estudiantes: [] }) } as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={() => {}} />);
  await pantalla.findByRole("heading", {name:"PC"});
  disparar.click(pantalla.getByRole("button", {name:"Añadir pregunta"}));
  esperar(pantalla.getByLabelText("Máximo P2")).toBeInTheDocument();
});

prueba("prepara y califica solo después de la autorización sin pedir tarifas", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave-prueba",modelo:"modelo-prueba"}, false);
  const evaluacion = {id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,indicaciones_profesor:"",criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"A"}],soluciones_profesor:[{id:"s"}],materiales_apoyo:[],examenes_estudiantes:[{id:"e",estado_revision:"pendiente",detalles_preguntas:[]}]};
  const datos = simular.fn(async (ruta: string) => ruta.endsWith('/preparar') ? {examenes:1,huella:'a'.repeat(64)} : {guardado:true});
  const servicio = {evaluacion:async()=>evaluacion,datos} as unknown as ServicioBiblioteca;
  try {
    representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
    await pantalla.findByRole("heading",{name:"PC"});
    esperar(pantalla.queryByLabelText(/Tarifa de entrada/)).not.toBeInTheDocument();
    disparar.click(pantalla.getByRole("button",{name:"Preparar calificación"}));
    const autorizar = await pantalla.findByRole("checkbox",{name:/Autorizo el envío/});
    esperar(datos).toHaveBeenCalledTimes(1);
    esperar(pantalla.getByRole("button",{name:"Confirmar y calificar lote"})).toBeDisabled();
    disparar.click(autorizar);
    disparar.click(pantalla.getByRole("button",{name:"Confirmar y calificar lote"}));
    esperar(await pantalla.findByText(/Lote terminado/)).toBeInTheDocument();
    esperar(datos.mock.calls.some(([ruta])=>ruta.endsWith('/calificar/e'))).toBe(true);
  } finally { sessionStorage.clear(); }
});

