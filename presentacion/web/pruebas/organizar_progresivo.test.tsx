import { render as representar, screen as pantalla, fireEvent as disparar } from '@testing-library/react';
import { test as prueba, expect as esperar, vi as simular } from 'vitest';
import { OrganizarBiblioteca } from '../componentes/OrganizarBiblioteca';
import { Explorador } from '../componentes/Explorador';
import { Aplicacion } from '../Aplicacion';
import { NuevaEvaluacion } from '../componentes/NuevaEvaluacion';
import type { ServicioBiblioteca } from '../servicios/biblioteca';

prueba('muestra la facultad solo después de elegir el año', () => {
  const anios = [{id:'a',anio:2026,facultades:[{id:'f',nombre:'Ingeniería',escuelas:[]}]}];
  representar(<OrganizarBiblioteca anios={anios} servicio={{} as ServicioBiblioteca} cerrar={()=>{}} alGuardar={async()=>{}} />);
  esperar(pantalla.getByLabelText('Año académico')).toBeInTheDocument();
  esperar(pantalla.queryByLabelText('Facultad')).not.toBeInTheDocument();
  disparar.change(pantalla.getByLabelText('Año académico'), {target:{value:'a'}});
  esperar(pantalla.getByLabelText('Facultad')).toBeInTheDocument();
  esperar(pantalla.queryByLabelText('Escuela profesional')).not.toBeInTheDocument();
});

prueba('ofrece un solo acceso para organizar cuando la biblioteca está vacía', () => {
  representar(<Explorador nodos={[]} alOrganizar={()=>{}} />);
  esperar(pantalla.getAllByRole('button', {name:/organizar/i})).toHaveLength(1);
});

prueba('permite solicitar la eliminación de un elemento del árbol', () => {
  const eliminar = simular.fn();
  representar(<Explorador nodos={[{id:'a',nombre:'2026',tipo:'anios_academicos',hijos:[]}]} alEliminar={eliminar} />);
  disparar.click(pantalla.getByRole('button', {name:'Eliminar 2026'}));
  esperar(eliminar).toHaveBeenCalledWith('anios_academicos', 'a', '2026');
});

prueba('identifica en el área principal el nivel seleccionado', () => {
  representar(<Aplicacion nodos={[{id:'a',nombre:'2026',hijos:[{id:'f',nombre:'Industrial',hijos:[]}]}]} activo="f" />);
  esperar(pantalla.getByRole('heading',{name:'Industrial'})).toBeInTheDocument();
});

prueba('al crear una evaluación desde un curso usa el curso seleccionado', () => {
  representar(<NuevaEvaluacion cursos={[{id:'c',nombre:'Física',evaluaciones:[]}]} cursoInicial="c" servicio={{} as ServicioBiblioteca} cerrar={()=>{}} alCrear={()=>{}} />);
  esperar(pantalla.getByText('Física')).toBeInTheDocument();
  esperar(pantalla.queryByRole('combobox', {name:'Curso'})).not.toBeInTheDocument();
});

prueba('no crea una facultad que ya existe con distintas mayúsculas', async () => {
  const crearNodo = simular.fn();
  const anios = [{id:'a',anio:2026,facultades:[{id:'f',nombre:'Industrial',escuelas:[]}]}];
  representar(<OrganizarBiblioteca anios={anios} servicio={{crearNodo} as unknown as ServicioBiblioteca} cerrar={()=>{}} alGuardar={async()=>{}} />);
  disparar.change(pantalla.getByLabelText('Año académico'), {target:{value:'a'}});
  disparar.change(pantalla.getByLabelText('Facultad'), {target:{value:'__nuevo__'}});
  disparar.change(pantalla.getByLabelText('Nombre de facultad'), {target:{value:' industrial '}});
  disparar.click(pantalla.getByRole('button', {name:'Crear facultad'}));
  esperar(await pantalla.findByRole('alert')).toHaveTextContent('Ya existe');
  esperar(crearNodo).not.toHaveBeenCalled();
});

prueba('avisa si se intenta crear un nombre casi igual', async () => {
  const crearNodo = simular.fn();
  const anios = [{id:'a',anio:2026,facultades:[{id:'f',nombre:'Informatica',escuelas:[]}]}];
  representar(<OrganizarBiblioteca anios={anios} servicio={{crearNodo} as unknown as ServicioBiblioteca} cerrar={()=>{}} alGuardar={async()=>{}} />);
  disparar.change(pantalla.getByLabelText('Año académico'), {target:{value:'a'}});
  disparar.change(pantalla.getByLabelText('Facultad'), {target:{value:'__nuevo__'}});
  disparar.change(pantalla.getByLabelText('Nombre de facultad'), {target:{value:'Informatic'}});
  disparar.click(pantalla.getByRole('button', {name:'Crear facultad'}));
  esperar(await pantalla.findByRole('alert')).toHaveTextContent('parecido');
  esperar(crearNodo).not.toHaveBeenCalled();
});
