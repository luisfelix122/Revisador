import { render as representar, screen as pantalla, fireEvent as disparar, waitFor as esperarQue, act as actuar } from "@testing-library/react";
import { test as prueba, expect as esperar, vi as espia, beforeEach as antesDeCada } from "vitest";
import { PortalEntregaAlumno } from "../componentes/PortalEntregaAlumno";
import { RecepcionAlumnos } from "../componentes/RecepcionAlumnos";
import { TiempoRestante } from "../componentes/TiempoRestante";
import type { EvaluacionDetalle, ServicioBiblioteca } from "../servicios/biblioteca";

antesDeCada(() => {
  espia.restoreAllMocks();
});

prueba("el alumno ve el tiempo restante de la recepción", async () => {
  const ahora = Date.parse('2026-11-05T12:00:00Z');
  espia.spyOn(Date, 'now').mockReturnValue(ahora);
  globalThis.fetch = espia.fn().mockResolvedValue({ok:true, json:async()=>({titulo:'Examen con plazo', curso:'Curso', facultad:'Facultad', escuela:'Escuela', anio:2026, puntaje_maximo:20, recepcion_abierta:true, fecha_cierre:'2026-11-05T12:02:05Z'})});
  representar(<PortalEntregaAlumno token="token" />);
  esperar(await pantalla.findByText(/Tiempo restante estimado: 02:05/)).toBeInTheDocument();
});

prueba("el portal muestra el motivo cuando el enlace no está disponible", async () => {
  globalThis.fetch = espia.fn().mockResolvedValue({ok:false, json:async()=>({detail:'Evaluación no encontrada'})});
  representar(<PortalEntregaAlumno token="invalido" />);
  esperar(await pantalla.findByText('Evaluación no encontrada')).toBeInTheDocument();
});

prueba("la cuenta regresiva avanza y al terminar pide actualizar el estado", () => {
  espia.useFakeTimers();
  try {
    espia.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    representar(<TiempoRestante fechaCierre="2026-11-05T12:00:02Z" />);
    esperar(pantalla.getByText(/Tiempo restante estimado: 00:02/)).toBeInTheDocument();
    actuar(() => espia.advanceTimersByTime(2000));
    esperar(pantalla.getByText(/Tiempo estimado agotado/)).toBeInTheDocument();
  } finally {
    espia.useRealTimers();
  }
});

prueba("el docente ve el tiempo restante de la recepción", () => {
  espia.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-05T12:00:00Z'));
  const evaluacion = {id:'pc', titulo:'Examen', indicaciones_profesor:'', puntaje_total_maximo:20, estado:'borrador', criterios_preguntas:[], soluciones_profesor:[], materiales_apoyo:[], cursos:{id:'c',nombre:'Curso',evaluaciones:[]}, recepcion_abierta:true, fecha_cierre_programada:'2026-11-05T12:02:05Z', examenes_estudiantes:[]} as EvaluacionDetalle;
  representar(<RecepcionAlumnos evaluacion={evaluacion} servicio={{} as ServicioBiblioteca} apiVerificada={false} alActualizar={async()=>{}} alRevisarExamen={()=>{}} alCalificarLote={async()=>{}} ocupado={false} corriendo={false} />);
  esperar(pantalla.getByText(/Tiempo restante estimado: 02:05/)).toBeInTheDocument();
});

prueba("PortalEntregaAlumno muestra jerarquía académica y botón deshabilitado sin archivo", async () => {
  const infoMock = {
    evaluacion_id: "eval-1",
    titulo: "Examen Parcial de Álgebra",
    curso: "Álgebra Lineal",
    facultad: "Facultad de Ingeniería",
    escuela: "Ingeniería de Sistemas",
    anio: 2026,
    puntaje_maximo: 20,
    recepcion_abierta: true,
  };

  globalThis.fetch = espia.fn().mockResolvedValue({
    ok: true,
    json: async () => infoMock,
  });

  representar(<PortalEntregaAlumno token="token-test-123" />);

  // Esperar a que cargue la información
  await esperarQue(() => {
    esperar(pantalla.getByText(/Examen Parcial de Álgebra/i)).toBeInTheDocument();
  });

  // Verificar jerarquía académica en pantalla
  esperar(pantalla.getByText(/2026/i)).toBeInTheDocument();
  esperar(pantalla.getByText(/Facultad de Ingeniería/i)).toBeInTheDocument();
  esperar(pantalla.getByText(/Ingeniería de Sistemas/i)).toBeInTheDocument();
  esperar(pantalla.getByText(/Álgebra Lineal/i)).toBeInTheDocument();

  // El botón de entregar debe estar deshabilitado hasta que se seleccione archivo
  const botonEntregar = pantalla.getByRole("button", { name: /Confirmar y entregar examen/i });
  esperar(botonEntregar).toBeDisabled();
});

prueba("PortalEntregaAlumno muestra el motivo concreto si se rechaza una entrega", async () => {
  globalThis.fetch = espia.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ titulo: 'Examen', curso: 'Curso', facultad: 'Facultad', escuela: 'Escuela', anio: 2026, puntaje_maximo: 20, recepcion_abierta: true }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ detail: 'Solicita autorización para reenviar.' }) });
  const { container } = representar(<PortalEntregaAlumno token="token" />);
  await pantalla.findByText('Examen');
  disparar.change(pantalla.getByLabelText(/Código universitario/i), { target: { value: '123' } });
  disparar.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['archivo'], 'examen.pdf', { type: 'application/pdf' })] } });
  disparar.click(pantalla.getByRole('button', { name: /Confirmar y entregar examen/i }));
  esperar(await pantalla.findByText('Solicita autorización para reenviar.')).toBeInTheDocument();
});

prueba("PortalEntregaAlumno permite previsualizar y rotar foto antes de confirmar", async () => {
  const infoMock = {
    evaluacion_id: "eval-1",
    titulo: "Práctica Calificada 1",
    curso: "Cálculo I",
    facultad: "Ciencias",
    escuela: "Matemática",
    anio: 2026,
    puntaje_maximo: 20,
    recepcion_abierta: true,
  };

  globalThis.fetch = espia.fn().mockImplementation((url: string) => {
    if (url.includes("/api/recepcion/token-456/entregar")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          examen_id: "ex-1",
          numero_entrega: 1,
          codigo_estudiante: "2024001",
          nombre_estudiante: "Carlos Gómez",
          entregado_en: new Date().toISOString(),
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => infoMock,
    });
  });

  // Mock URL.createObjectURL
  window.URL.createObjectURL = espia.fn().mockReturnValue("blob:http://localhost/test-preview");

  const { container } = representar(<PortalEntregaAlumno token="token-456" />);

  await esperarQue(() => {
    esperar(pantalla.getByText(/Práctica Calificada 1/i)).toBeInTheDocument();
  });

  // Rellenar datos
  disparar.change(pantalla.getByLabelText(/Código universitario/i), { target: { value: "2024001" } });
  disparar.change(pantalla.getByLabelText(/Apellidos y Nombres/i), { target: { value: "Carlos Gómez" } });

  // Simular subida de archivo
  const archivo = new File(["contenido-imagen"], "examen.png", { type: "image/png" });
  const inputArchivo = container.querySelector('input[type="file"]') as HTMLInputElement;
  esperar(inputArchivo).not.toBeNull();
  disparar.change(inputArchivo, { target: { files: [archivo] } });

  // Verificar botón de girar
  const botonGirar = await pantalla.findByRole("button", { name: /Girar página 1/i });
  esperar(botonGirar).toBeInTheDocument();
  disparar.click(botonGirar); // Gira a 90°

  esperar(pantalla.getByAltText('Vista previa de la página 1')).toHaveStyle({ transform: 'rotate(90deg)' });
  esperar(pantalla.getByRole("button", { name: /Confirmar y entregar examen/i })).not.toBeDisabled();
});

prueba("RecepcionAlumnos panel docente permite cerrar entregas y copiar enlace", async () => {
  const evaluacionMock: EvaluacionDetalle = {
    id: "eval-docente-1",
    titulo: "Final de Física",
    indicaciones_profesor: "",
    puntaje_total_maximo: 20,
    estado: "borrador",
    token_recepcion: "tok-fisica",
    recepcion_abierta: true,
    tiempo_limite_minutos: 30,
    fecha_cierre_programada: null,
    permitir_reenvios_global: false,
    criterios_preguntas: [],
    soluciones_profesor: [],
    materiales_apoyo: [],
    examenes_estudiantes: [
      {
        id: "ex-1",
        nombre_estudiante: "Alumno 1",
        codigo_estudiante: "COD001",
        nota_final: 0,
        observaciones_generales: "",
        estado_revision: "pendiente",
        revisado_por_profesor: false,
        numero_entregas: 1,
        permitir_reenvio: false,
        detalles_preguntas: [],
        historial_entregas_estudiantes: [],
      },
    ],
    cursos: {
      id: "c-1",
      nombre: "Física General",
      evaluaciones: [],
    },
  };

  const servicioMock = {
    configurarRecepcion: espia.fn().mockResolvedValue({}),
    permitirReenvioAlumno: espia.fn().mockResolvedValue({}),
  } as unknown as ServicioBiblioteca;

  const alActualizarMock = espia.fn().mockResolvedValue(undefined);
  const alCalificarLoteMock = espia.fn().mockResolvedValue(undefined);
  const alRevisarExamenMock = espia.fn();

  // Mock clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText: espia.fn().mockResolvedValue(undefined),
    },
  });

  representar(
    <RecepcionAlumnos
      evaluacion={evaluacionMock}
      servicio={servicioMock}
      apiVerificada={true}
      alActualizar={alActualizarMock}
      alRevisarExamen={alRevisarExamenMock}
      alCalificarLote={alCalificarLoteMock}
      ocupado={false}
      corriendo={false}
    />
  );

  // Verificar título del módulo
  esperar(pantalla.getByText(/Enlace de recepción para estudiantes/i)).toBeInTheDocument();
  esperar(pantalla.getByText(/Alumno 1/i)).toBeInTheDocument();
  esperar(pantalla.getByText(/COD001/i)).toBeInTheDocument();

  // Probar copiar enlace
  const botonCopiar = pantalla.getByRole("button", { name: /Copiar enlace/i });
  disparar.click(botonCopiar);
  esperar(navigator.clipboard.writeText).toHaveBeenCalledWith(esperar.stringContaining("?entrega=tok-fisica"));

  // Probar cerrar entregas
  const botonCerrar = pantalla.getByRole("button", { name: /Cerrar entregas ahora/i });
  disparar.click(botonCerrar);
  esperar(servicioMock.configurarRecepcion).toHaveBeenCalledWith("eval-docente-1", false, null, false, null);

  // Probar filtro por lotes
  const botonRevisarPendientes = pantalla.getByRole("button", { name: /Revisar solo pendientes/i });
  disparar.click(botonRevisarPendientes);
  esperar(alCalificarLoteMock).toHaveBeenCalledWith("pendientes");
});

prueba("RecepcionAlumnos permite configurar el aforo de estudiantes esperados", async () => {
  const evaluacionMock: EvaluacionDetalle = {
    id: "eval-aforo-1",
    titulo: "Examen Final de Estadística",
    indicaciones_profesor: "",
    puntaje_total_maximo: 20,
    estado: "borrador",
    token_recepcion: "tok-estadistica",
    recepcion_abierta: true,
    tiempo_limite_minutos: null,
    fecha_cierre_programada: null,
    permitir_reenvios_global: false,
    cantidad_estudiantes_esperados: null,
    criterios_preguntas: [],
    soluciones_profesor: [],
    materiales_apoyo: [],
    examenes_estudiantes: [],
    cursos: {
      id: "c-est",
      nombre: "Estadística Aplicada",
      evaluaciones: [],
    },
  };

  const servicioMock = {
    configurarRecepcion: espia.fn().mockResolvedValue({}),
    permitirReenvioAlumno: espia.fn().mockResolvedValue({}),
  } as unknown as ServicioBiblioteca;

  const alActualizarMock = espia.fn().mockResolvedValue(undefined);

  representar(
    <RecepcionAlumnos
      evaluacion={evaluacionMock}
      servicio={servicioMock}
      apiVerificada={true}
      alActualizar={alActualizarMock}
      alRevisarExamen={espia.fn()}
      alCalificarLote={espia.fn()}
      ocupado={false}
      corriendo={false}
    />
  );

  // Verificar presencia de la sección de aforo
  esperar(pantalla.getByText(/Aforo de alumnos en aula/i)).toBeInTheDocument();

  // Cambiar el valor del aforo a 35 estudiantes
  const inputAforo = pantalla.getByLabelText(/Cantidad de alumnos en aula/i);
  disparar.change(inputAforo, { target: { value: "35" } });

  // Guardar el aforo
  const botonGuardar = pantalla.getByRole("button", { name: /Guardar aforo/i });
  disparar.click(botonGuardar);

  // Verificar que se invocó el servicio con el aforo numérico 35
  await esperarQue(() => {
    esperar(servicioMock.configurarRecepcion).toHaveBeenCalledWith("eval-aforo-1", true, null, false, 35);
  });
});

prueba("PortalEntregaAlumno muestra aviso de aforo completado si cupo_alcanzado es verdadero", async () => {
  const infoConCupoLleno = {
    evaluacion_id: "eval-llena",
    titulo: "Examen de Inteligencia Artificial",
    curso: "IA",
    facultad: "Ingeniería",
    escuela: "Sistemas",
    anio: 2026,
    puntaje_maximo: 20,
    recepcion_abierta: true,
    cantidad_estudiantes_esperados: 25,
    total_entregados: 25,
    cupo_alcanzado: true,
  };

  globalThis.fetch = espia.fn().mockResolvedValue({
    ok: true,
    json: async () => infoConCupoLleno,
  });

  representar(<PortalEntregaAlumno token="token-lleno" />);

  await esperarQue(() => {
    esperar(pantalla.getByText(/Examen de Inteligencia Artificial/i)).toBeInTheDocument();
  });

  // Debe mostrar aviso de aforo completado
  esperar(pantalla.getByText(/Aforo completado:/i)).toBeInTheDocument();
  esperar(pantalla.getByText(/25 alumnos/i)).toBeInTheDocument();
});

prueba("el alumno agrega, gira y ordena varias fotos en una sola entrega", async () => {
  globalThis.fetch = espia.fn().mockResolvedValue({ok:true,json:async()=>({titulo:'Examen',curso:'Curso',facultad:'Facultad',escuela:'Escuela',anio:2026,puntaje_maximo:20,recepcion_abierta:true})});
  representar(<PortalEntregaAlumno token="token" />);
  await pantalla.findByText('Examen');
  const input=pantalla.getByLabelText('Seleccionar fotos del examen');
  disparar.change(input,{target:{files:[new File(['uno'],'uno.jpg',{type:'image/jpeg'}),new File(['dos'],'dos.jpg',{type:'image/jpeg'})]}});
  esperar(pantalla.getByText('uno.jpg')).toBeInTheDocument();
  esperar(pantalla.getByText('dos.jpg')).toBeInTheDocument();
  disparar.click(pantalla.getByRole('button',{name:'Girar página 2'}));
  disparar.click(pantalla.getByRole('button',{name:'Subir página 2'}));
  esperar(pantalla.getByText('dos.jpg').closest('li')).toHaveTextContent('Página 1');
  disparar.click(pantalla.getByRole('button',{name:'Quitar página 2'}));
  esperar(pantalla.queryByText('uno.jpg')).not.toBeInTheDocument();
});
