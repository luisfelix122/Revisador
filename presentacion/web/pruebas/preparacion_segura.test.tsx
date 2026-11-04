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
