import {
  render as representar,
  screen as pantalla,
  fireEvent as disparar,
  waitFor as esperarQue,
  within as dentroDe,
} from "@testing-library/react";
import { test as prueba, expect as esperar, vi as simular } from "vitest";
import type { SupabaseClient as ClienteSupabase } from "@supabase/supabase-js";
import { ServicioBiblioteca } from "../servicios/biblioteca";
import { DetalleEvaluacion } from "../componentes/DetalleEvaluacion";
import { guardarCredenciales } from "../servicios/credenciales";

prueba("organiza la preparación en pasos y permite volver sin perder la rúbrica", async () => {
  const servicio = {evaluacion:async()=>({id:'pc',titulo:'PC',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[{id:'solucion'}],materiales_apoyo:[],examenes_estudiantes:[]})} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  esperar(pantalla.getByText('Solución oficial guardada')).toBeInTheDocument();
  disparar.click(pantalla.getByRole('button',{name:/Paso 2.*Criterios/}));
  disparar.click(pantalla.getByRole('button',{name:'Añadir pregunta'}));
  esperar(pantalla.getByLabelText('Máximo P1')).toHaveValue(1);
  disparar.click(pantalla.getByRole('button',{name:/Paso 1.*Archivos/}));
  disparar.click(pantalla.getByRole('button',{name:/Paso 2.*Criterios/}));
  esperar(pantalla.getByLabelText('Máximo P1')).toHaveValue(1);
});

prueba("no permite avanzar sin solución", async () => {
  const datos = {id:'pc',titulo:'PC',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[],materiales_apoyo:[],examenes_estudiantes:[],recepcion_abierta:true};
  const servicio = {evaluacion:async()=>datos} as unknown as ServicioBiblioteca;
  const vista = representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  esperar(pantalla.getByRole('button',{name:/Paso 2.*Criterios/})).toBeDisabled();
  esperar(pantalla.getByRole('button',{name:'Continuar a criterios'})).toBeDisabled();
  vista.unmount();
});

prueba("habilita el análisis después de cerrar la recepción con exámenes recibidos", async () => {
  const datos = {id:'pc',titulo:'PC',estado:'borrador',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[{id:'s'}],materiales_apoyo:[],examenes_estudiantes:[{id:'e',estado_revision:'pendiente',detalles_preguntas:[]}],recepcion_abierta:true,recepcion_iniciada:true};
  const servicio = {evaluacion:async()=>({...datos}), configurarRecepcion:async()=>{datos.recepcion_abierta=false}} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  esperar(pantalla.getByRole('button',{name:'Permitir reenvío'})).toBeInTheDocument();
  esperar(pantalla.queryByText(/Calificados:/)).not.toBeInTheDocument();
  disparar.click(pantalla.getByRole('checkbox',{name:/Autorizo una llamada de IA/}));
  esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeDisabled();
  disparar.click(pantalla.getByRole('button',{name:'Cerrar entregas ahora'}));
  await esperarQue(() => esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeEnabled());
});

prueba("en carga manual el docente confirma que terminó antes de analizar", async () => {
  const datos = {id:'pc',titulo:'PC',estado:'borrador',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[{id:'s'}],materiales_apoyo:[],examenes_estudiantes:[{id:'e',estado_revision:'pendiente',detalles_preguntas:[]}],recepcion_abierta:false,modalidad_recepcion:'manual',carga_manual_finalizada:false};
  const servicio = {evaluacion:async()=>datos, configurarModalidad:async(_id:string,_modo:string,finalizada:boolean)=>{datos.carga_manual_finalizada=finalizada}} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.click(pantalla.getByRole('button',{name:'Carga manual del docente'}));
  disparar.click(pantalla.getByRole('checkbox',{name:/Autorizo una llamada de IA/}));
  esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeDisabled();
  disparar.click(pantalla.getByRole('checkbox',{name:/Terminé de cargar los exámenes/}));
  await esperarQue(() => esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeEnabled());
  esperar(pantalla.queryByLabelText('Exámenes de estudiantes')).not.toBeInTheDocument();
});

prueba("permite analizar al vencer el plazo aunque no se hayan recibido exámenes", async () => {
  const datos = {id:'pc',titulo:'PC',estado:'borrador',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[{id:'s'}],materiales_apoyo:[],examenes_estudiantes:[],recepcion_abierta:true,recepcion_iniciada:true,fecha_cierre_programada:'2020-01-01T00:00:00Z'};
  const servicio = {evaluacion:async()=>datos} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.click(pantalla.getByRole('checkbox',{name:/Autorizo una llamada de IA/}));
  esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeEnabled();
});

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
      esperar(pantalla.queryByLabelText("Exámenes de estudiantes")).not.toBeInTheDocument();
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
  const evaluacion = {id:"evaluacion",titulo:"Parcial",cursos:{nombre:"Álgebra"},puntaje_total_maximo:20,indicaciones_profesor:"",modalidad_recepcion:'manual',carga_manual_finalizada:true,criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"Respuesta"}],soluciones_profesor:[{ruta_almacenamiento:"solucion"}],materiales_apoyo:[],examenes_estudiantes:[{id:"examen",estado_revision:"pendiente"}]};
  const peticion = simular.spyOn(globalThis,"fetch").mockImplementation(async (entrada) => {
    const ruta=String(entrada);
    return new Response(JSON.stringify(ruta.endsWith('/preparar') ? {examenes:1,huella:"a".repeat(64)} : evaluacion),{status:200});
  });
  const cliente = {auth:{getSession:async()=>({data:{session:{access_token:"token-prueba"}}})}} as unknown as ClienteSupabase;
  try {
    representar(<DetalleEvaluacion identificador="evaluacion" servicio={new ServicioBiblioteca(cliente)} apiVerificada={true} alVolver={()=>{}} />);
    await pantalla.findByRole("heading",{name:"Parcial"});
    esperar(pantalla.queryByText("Presupuesto y calificación del lote")).not.toBeInTheDocument();
    disparar.click(pantalla.getByRole('button',{name:/Paso 3.*Revisión/}));
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
  esperar(pantalla.getByLabelText("Solución oficial")).toBeInTheDocument();
});

prueba("considera aprobada la nota 10,5 y desaprobada la nota inferior", async () => {
  const examen = (id: string, nota: number) => ({ id, nombre_estudiante: id, codigo_estudiante: id, nota_final: nota, estado_revision: "completado", observaciones_generales: "", detalles_preguntas: [] });
  const servicio = { evaluacion: async () => ({ id: "pc", titulo: "PC", cursos: { nombre: "Curso" }, puntaje_total_maximo: 20, criterios_preguntas: [], soluciones_profesor: [], materiales_apoyo: [], examenes_estudiantes: [examen("Ana",10.5), examen("Luis",10.49)] }) } as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={() => {}} />);
  await pantalla.findByRole("heading", { name: "PC" });
  disparar.change(pantalla.getByLabelText("Filtrar resultados"), { target: { value: "aprobados" } });
  const resultados = pantalla.getByRole('heading',{name:'Resultados y revisión docente'}).closest('section')!;
  esperar(dentroDe(resultados).getAllByText("Ana").length).toBeGreaterThan(0);
  esperar(dentroDe(resultados).queryByText("Luis")).not.toBeInTheDocument();
});

prueba("añade una pregunta sin repetir números existentes en la rúbrica", async () => {
  const servicio = { evaluacion: async () => ({ id: "pc", titulo: "PC", cursos: { nombre: "Curso" }, puntaje_total_maximo: 20, criterios_preguntas: [{numero_pregunta:1,puntaje_maximo:10,respuesta_esperada:"A"},{numero_pregunta:3,puntaje_maximo:10,respuesta_esperada:"B"}], soluciones_profesor: [{id:'s'}], materiales_apoyo: [], examenes_estudiantes: [] }) } as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={() => {}} />);
  await pantalla.findByRole("heading", {name:"PC"});
  disparar.click(pantalla.getByRole("button", {name:/Paso 2.*Criterios/}));
  disparar.click(pantalla.getByRole("button", {name:"Añadir pregunta"}));
  esperar(pantalla.getByLabelText("Máximo P2")).toBeInTheDocument();
});

prueba("prepara y califica solo después de la autorización sin pedir tarifas", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave-prueba",modelo:"modelo-prueba"}, false);
  const evaluacion = {id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,indicaciones_profesor:"",modalidad_recepcion:'manual',carga_manual_finalizada:true,criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"A"}],soluciones_profesor:[{id:"s"}],materiales_apoyo:[],examenes_estudiantes:[{id:"e",estado_revision:"pendiente",detalles_preguntas:[]}]};
  const datos = simular.fn(async (ruta: string) => ruta.endsWith('/preparar') ? {examenes:1,huella:'a'.repeat(64)} : {guardado:true});
  const servicio = {evaluacion:async()=>evaluacion,datos} as unknown as ServicioBiblioteca;
  try {
    representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
    await pantalla.findByRole("heading",{name:"PC"});
    disparar.click(pantalla.getByRole('button',{name:/Paso 3.*Revisión/}));
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


prueba("el cambio de pestaña no confirma una carga manual incompleta", async () => {
  const datos = {id:'pc',titulo:'PC',estado:'borrador',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[{id:'s'}],materiales_apoyo:[],examenes_estudiantes:[{id:'e',estado_revision:'pendiente',detalles_preguntas:[]}],recepcion_abierta:false,modalidad_recepcion:'manual',recepcion_iniciada:false,carga_manual_finalizada:false};
  const servicio = {evaluacion:async()=>({...datos}), configurarModalidad:simular.fn().mockRejectedValue(new Error('Confirma que terminaste la carga manual antes de cambiar de modalidad.'))} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.click(pantalla.getByRole('checkbox',{name:/Autorizo una llamada de IA/}));
  disparar.click(pantalla.getByRole('button',{name:'Enlace para alumnos'}));
  esperar(await pantalla.findByRole('alert')).toHaveTextContent('Confirma que terminaste la carga manual');
  esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeDisabled();
});

prueba("recuerda la confirmación manual al volver a abrir una evaluación", async () => {
  const datos = {id:'pc',titulo:'PC',estado:'borrador',cursos:{nombre:'Curso'},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[{id:'s'}],materiales_apoyo:[],examenes_estudiantes:[{id:'e',estado_revision:'pendiente',detalles_preguntas:[]}],recepcion_abierta:false,modalidad_recepcion:'manual',recepcion_iniciada:false,carga_manual_finalizada:true};
  const servicio = {evaluacion:async()=>({...datos})} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  esperar(pantalla.getByRole('checkbox',{name:/Terminé de cargar los exámenes/})).toBeChecked();
  disparar.click(pantalla.getByRole('checkbox',{name:/Autorizo una llamada de IA/}));
  esperar(pantalla.getByRole('button',{name:'Analizar solución con IA'})).toBeEnabled();
});

prueba("clasifica resultados con el mínimo de aprobación propio de la evaluación", async () => {
  const examen=(id:string,nota:number)=>({id,nombre_estudiante:id,codigo_estudiante:id,nota_final:nota,estado_revision:'completado',observaciones_generales:'',detalles_preguntas:[]});
  const servicio={evaluacion:async()=>({id:'pc',titulo:'PC',cursos:{nombre:'Curso'},puntaje_total_maximo:100,puntaje_aprobatorio:60,criterios_preguntas:[],soluciones_profesor:[],materiales_apoyo:[],examenes_estudiantes:[examen('Ana',55),examen('Luis',60)]})} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.change(pantalla.getByLabelText('Filtrar resultados'),{target:{value:'aprobados'}});
  const resultados=pantalla.getByRole('heading',{name:'Resultados y revisión docente'}).closest('section')!;
  esperar(dentroDe(resultados).queryByText('Ana')).not.toBeInTheDocument();
  esperar(dentroDe(resultados).getAllByText('Luis').length).toBeGreaterThan(0);
});

prueba("el docente puede cambiar el mínimo de aprobación guardado", async () => {
  const datos={id:'pc',titulo:'PC',cursos:{nombre:'Curso'},puntaje_total_maximo:100,puntaje_aprobatorio:52.5,criterios_preguntas:[],soluciones_profesor:[],materiales_apoyo:[],examenes_estudiantes:[]};
  const configurar=simular.fn(async (_id:string, puntaje:number)=>{datos.puntaje_aprobatorio=puntaje});
  const servicio={evaluacion:async()=>({...datos}),configurarPuntajeAprobatorio:configurar} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.change(pantalla.getByLabelText('Puntaje mínimo para aprobar'),{target:{value:'60'}});
  disparar.click(pantalla.getByRole('button',{name:'Guardar mínimo'}));
  await esperarQue(()=>esperar(configurar).toHaveBeenCalledWith('pc',60));
  esperar(await pantalla.findByText('Puntaje mínimo actualizado.')).toBeInTheDocument();
});
