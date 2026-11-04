import { render as representar, screen as pantalla, fireEvent as disparar } from "@testing-library/react";
import { test as prueba, expect as esperar, vi as simular } from "vitest";
import { DetalleEvaluacion } from "../componentes/DetalleEvaluacion";
import type { ServicioBiblioteca } from "../servicios/biblioteca";

prueba("al recuperar una evaluación desaparece el error anterior", async () => {
  const evaluacion={id:"pc",titulo:"PC",cursos:{nombre:"Curso"},puntaje_total_maximo:20,criterios_preguntas:[],soluciones_profesor:[],materiales_apoyo:[],examenes_estudiantes:[]};
  const servicio={evaluacion:simular.fn().mockRejectedValueOnce(new Error('Conexión interrumpida')).mockResolvedValueOnce(evaluacion)} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={()=>{}} />);
  esperar(await pantalla.findByRole("alert")).toHaveTextContent('Conexión interrumpida');
  disparar.click(pantalla.getByRole("button",{name:"Reintentar"}));
  await pantalla.findByRole("heading",{name:"PC"});
  esperar(pantalla.queryByRole("alert")).not.toBeInTheDocument();
});

prueba("un reintento fallido muestra el error actualizado", async () => {
  const servicio={evaluacion:simular.fn().mockRejectedValueOnce(new Error('Primer error')).mockRejectedValueOnce(new Error('Segundo error'))} as unknown as ServicioBiblioteca;
  representar(<DetalleEvaluacion identificador="pc" servicio={servicio} apiVerificada={false} alVolver={()=>{}} />);
  esperar(await pantalla.findByRole("alert")).toHaveTextContent('Primer error');
  disparar.click(pantalla.getByRole("button",{name:"Reintentar"}));
  esperar(await pantalla.findByRole("alert")).toHaveTextContent('Segundo error');
});
