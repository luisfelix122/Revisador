import { render as representar, screen as pantalla, fireEvent as disparar } from "@testing-library/react";
import { test as prueba, expect as esperar, vi as simular } from "vitest";
import { DetalleEvaluacion } from "../componentes/DetalleEvaluacion";
import { guardarCredenciales } from "../servicios/credenciales";
import type { ServicioBiblioteca } from "../servicios/biblioteca";

prueba("descarta autorización anterior si falla una nueva preparación", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave",modelo:"modelo"}, false);
  const evaluacion={id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"A"}],soluciones_profesor:[{id:"s"}],materiales_apoyo:[],examenes_estudiantes:[{id:"e",estado_revision:"pendiente",detalles_preguntas:[]}]};
  const datos=simular.fn().mockResolvedValueOnce({examenes:1,huella:'a'.repeat(64)}).mockRejectedValueOnce(new Error('No se pudo preparar'));
  const servicio={evaluacion:async()=>evaluacion,datos} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole("heading",{name:"PC"});
  disparar.click(pantalla.getByRole("button",{name:"Preparar calificación"}));
  disparar.click(await pantalla.findByRole("checkbox",{name:/Autorizo el envío/}));
  disparar.click(pantalla.getByRole("button",{name:"Preparar calificación"}));
  esperar(await pantalla.findByRole("alert")).toHaveTextContent('No se pudo preparar');
  esperar(pantalla.queryByRole("button",{name:"Confirmar y calificar lote"})).not.toBeInTheDocument();
});

prueba("la revisión desde recepción requiere autorización antes de enviar exámenes", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave",modelo:"modelo"}, false);
  const evaluacion={id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"A"}],soluciones_profesor:[{id:"s"}],materiales_apoyo:[],examenes_estudiantes:[{id:"e",nombre_estudiante:"Ana",codigo_estudiante:"1",estado_revision:"pendiente",detalles_preguntas:[]}]};
  const datos=simular.fn().mockResolvedValue({examenes:1,huella:'a'.repeat(64)});
  const servicio={evaluacion:async()=>evaluacion,datos} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole("heading",{name:"PC"});
  disparar.click(pantalla.getByRole('button',{name:/Recepción de alumnos/}));
  disparar.click(pantalla.getByRole('button',{name:/Revisar solo pendientes/}));
  await pantalla.findByRole('checkbox',{name:/Autorizo el envío/});
  esperar(datos.mock.calls.some(([ruta])=>String(ruta).includes('/calificar/'))).toBe(false);
  disparar.click(pantalla.getByRole('checkbox',{name:/Autorizo el envío/}));
  disparar.click(pantalla.getByRole('button',{name:'Confirmar y calificar lote'}));
  await pantalla.findByText(/Lote terminado/);
  esperar(datos.mock.calls.some(([ruta])=>String(ruta).endsWith('/calificar/e'))).toBe(true);
  sessionStorage.clear();
});

prueba("si falla reiniciar un examen, no se envía a calificar", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave",modelo:"modelo"}, false);
  const evaluacion={id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"A"}],soluciones_profesor:[{id:"s"}],materiales_apoyo:[],examenes_estudiantes:[{id:"e",nombre_estudiante:"Ana",codigo_estudiante:"1",estado_revision:"completado",detalles_preguntas:[]}]};
  const datos=simular.fn().mockResolvedValue({examenes:1,huella:'a'.repeat(64)});
  const servicio={evaluacion:async()=>evaluacion,datos,reiniciarExamen:simular.fn().mockRejectedValue(new Error('No se pudo reiniciar'))} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.click(pantalla.getByRole('button',{name:/Recepción de alumnos/}));
  disparar.click(pantalla.getByRole('button',{name:/Revisar a todos/}));
  disparar.click(await pantalla.findByRole('checkbox',{name:/Autorizo el envío/}));
  disparar.click(pantalla.getByRole('button',{name:'Confirmar y calificar lote'}));
  esperar(await pantalla.findByRole('alert')).toHaveTextContent('No se pudo reiniciar');
  esperar(datos.mock.calls.some(([ruta])=>String(ruta).includes('/calificar/'))).toBe(false);
  sessionStorage.clear();
});

prueba("el resumen muestra el costo estimado de los exámenes elegidos", async () => {
  guardarCredenciales({proveedor:"gemini",clave:"clave",modelo:"modelo"}, false);
  const evaluacion={id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,criterios_preguntas:[{numero_pregunta:1,puntaje_maximo:20,respuesta_esperada:"A"}],soluciones_profesor:[{id:"s"}],materiales_apoyo:[],examenes_estudiantes:[{id:"e",nombre_estudiante:"Ana",codigo_estudiante:"1",estado_revision:"completado",detalles_preguntas:[]}]};
  const datos=simular.fn().mockResolvedValue({examenes:1,huella:'a'.repeat(64), costo_usd:'0.0420'});
  const servicio={evaluacion:async()=>evaluacion,datos} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={true} alVolver={()=>{}} />);
  await pantalla.findByRole('heading',{name:'PC'});
  disparar.click(pantalla.getByRole('button',{name:/Recepción de alumnos/}));
  disparar.click(pantalla.getByRole('button',{name:/Revisar a todos/}));
  esperar(await pantalla.findByText(/Costo estimado: ~\$0.0420 USD/)).toBeInTheDocument();
  const opciones = datos.mock.calls[0][1] as RequestInit;
  esperar(JSON.parse(String(opciones.body)).examenes_ids).toEqual(['e']);
  sessionStorage.clear();
});
