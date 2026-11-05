import { render as representar, screen as pantalla, fireEvent as disparar, act as actuar } from '@testing-library/react';
import { test as prueba, expect as esperar, vi as simular } from 'vitest';
import { CalculadoraCostos } from '../componentes/CalculadoraCostos';
import { guardarCredenciales } from '../servicios/credenciales';

prueba('un modelo desconocido requiere tarifas introducidas por el docente', () => {
  guardarCredenciales({proveedor:'openai', clave:'clave', modelo:'modelo-desconocido'}, false);
  try {
    representar(<CalculadoraCostos />);
    esperar(pantalla.getByLabelText('Modelo para estimar')).toHaveValue('modelo-desconocido');
    esperar(pantalla.getByLabelText('Tarifa de entrada (USD / millón)')).toHaveValue(null);
    esperar(pantalla.getByLabelText('Tarifa de salida (USD / millón)')).toHaveValue(null);
    esperar(pantalla.getByRole('button', {name:'Calcular estimación'})).toBeDisabled();
  } finally { sessionStorage.clear(); }
});

prueba('una consulta tardía no sobrescribe la tarifa escrita por el docente', async () => {
  guardarCredenciales({proveedor:'gemini', clave:'clave', modelo:'gemini-flash-lite-latest'}, false);
  let resolver!: (respuesta: Response) => void;
  const peticion = simular.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((aceptar) => { resolver = aceptar; }));
  try {
    representar(<CalculadoraCostos />);
    disparar.change(pantalla.getByLabelText('Modelo para estimar'), {target:{value:'gemini-3.6-flash'}});
    disparar.change(pantalla.getByLabelText('Tarifa de entrada (USD / millón)'), {target:{value:'4'}});
    await actuar(async () => { resolver(new Response(JSON.stringify({tarifa_entrada:'1', tarifa_salida:'2'}), {status:200})); });
    esperar(pantalla.getByLabelText('Tarifa de entrada (USD / millón)')).toHaveValue(4);
  } finally { peticion.mockRestore(); sessionStorage.clear(); }
});
