import { render as representar, screen as pantalla, fireEvent as disparar } from "@testing-library/react";
import { test as prueba, expect as esperar } from "vitest";
import { DetalleEvaluacion } from "../componentes/DetalleEvaluacion";
import type { ServicioBiblioteca } from "../servicios/biblioteca";

prueba("al marcar respuesta como nada muestra puntaje cero antes de guardar", async () => {
  const examen = {id:"examen",nombre_estudiante:"Ana",codigo_estudiante:"01",nota_final:10,estado_revision:"completado",observaciones_generales:"",detalles_preguntas:[{numero_pregunta:1,puntaje_obtenido:10,puntaje_maximo:20,respuesta_detectada:"Respuesta",justificacion:"Parcial"}]};
  const servicio = {evaluacion:async()=>({id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[],materiales_apoyo:[],examenes_estudiantes:[examen]})} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={()=>{}} />);
  disparar.click(await pantalla.findByRole("button",{name:"Revisar preguntas"}));
  disparar.change(pantalla.getByLabelText("Respuesta detectada"),{target:{value:" Nada "}});
  esperar(pantalla.getByLabelText("Puntaje obtenido")).toHaveValue(0);
  esperar(pantalla.getByLabelText("Puntaje obtenido")).toBeDisabled();
  esperar(pantalla.getByText("Las respuestas sin contestar reciben cero puntos.")).toBeInTheDocument();
  esperar(pantalla.getByText("Total: 0.00")).toBeInTheDocument();
});
