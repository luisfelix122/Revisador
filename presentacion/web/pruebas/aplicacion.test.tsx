import {
  act as actuar,
  render as representar,
  screen as pantalla,
  within as dentroDe,
} from "@testing-library/react";
import { expect as esperar, test as prueba } from "vitest";
import { Aplicacion } from "../Aplicacion";
import usuario from "@testing-library/user-event";
import { vi as simular } from "vitest";

prueba("la ayuda refleja cuando el flujo de evaluaciones está conectado", async () => {
  representar(<Aplicacion alCrearEvaluacion={() => {}} />);
  await usuario.click(pantalla.getByRole("button", {name:"Cómo funciona"}));
  esperar(pantalla.queryByText(/procesamiento de evaluaciones aún no están conectados/)).not.toBeInTheDocument();
  esperar(pantalla.getByText(/Revisa los resultados antes de descargar/)).toBeInTheDocument();
}, 15000);

prueba(
  "muestra Revisador y el mensaje vacío exacto sin inventar actividad",
  () => {
    representar(<Aplicacion />);
    esperar(
      dentroDe(pantalla.getByRole("banner")).getByText("Revisador"),
    ).toBeInTheDocument();
    esperar(
      pantalla.getByText(
        "Todavía no hay archivos. Todo está vacío y sin tareas pendientes.",
      ),
    ).toBeInTheDocument();
    esperar(
      pantalla.getByRole("button", { name: "Abrir configuración" }),
    ).toBeInTheDocument();
  },
);

prueba(
  "el explorador notifica selección y regreso mediante eventos sin enrutamiento",
  async () => {
    const seleccionar = simular.fn(),
      regresar = simular.fn();
    representar(
      <Aplicacion
        nodos={[
          {
            id: "2026",
            nombre: "2026",
            hijos: [{ id: "ingenieria", nombre: "Ingeniería" }],
          },
        ]}
        alSeleccionar={seleccionar}
        alRegresar={regresar}
      />,
    );
    await usuario.click(
      pantalla.getByRole("button", { name: "Expandir 2026" }),
    );
    await usuario.click(pantalla.getByRole("button", { name: "Ingeniería" }));
    esperar(seleccionar).toHaveBeenCalledWith("ingenieria");
    await usuario.click(pantalla.getByRole("button", { name: "Regresar" }));
    esperar(regresar).toHaveBeenCalledOnce();
  },
);

prueba("abre configuración y permite cerrar con Escape", async () => {
  representar(<Aplicacion />);
  await usuario.click(
    pantalla.getByRole("button", { name: "Abrir configuración" }),
  );
  esperar(
    pantalla.getByRole("dialog", { name: "Configuración de IA" }),
  ).toBeInTheDocument();
  esperar(pantalla.getByLabelText("Clave de API")).toHaveAttribute(
    "type",
    "password",
  );
  await usuario.keyboard("{Escape}");
  esperar(pantalla.queryByRole("dialog")).not.toBeInTheDocument();
});

prueba(
  "guarda la clave solo en sesión salvo consentimiento explícito",
  async () => {
    representar(<Aplicacion />);
    await usuario.click(
      pantalla.getByRole("button", { name: "Abrir configuración" }),
    );
    await usuario.type(
      pantalla.getByLabelText("Clave de API"),
      "clave-local-prueba",
    );
    esperar(sessionStorage.getItem("revisador.ia")).toContain(
      "clave-local-prueba",
    );
    esperar(localStorage.getItem("revisador.ia")).toBeNull();
    await usuario.click(
      pantalla.getByRole("checkbox", { name: "Recordar en este equipo" }),
    );
    esperar(localStorage.getItem("revisador.ia")).toContain(
      "clave-local-prueba",
    );
    await usuario.click(
      pantalla.getByRole("checkbox", { name: "Recordar en este equipo" }),
    );
    esperar(localStorage.getItem("revisador.ia")).toBeNull();
  },
);

prueba(
  "comprobar muestra éxito real y editar clave invalida el check",
  async () => {
    const peticion = simular.spyOn(globalThis, "fetch");
    peticion.mockResolvedValueOnce(
      new Response(JSON.stringify({ modelos: ["modelo-prueba"] }), {
        status: 200,
      }),
    );
    peticion.mockResolvedValueOnce(
      new Response(JSON.stringify({ verificada: true }), { status: 200 }),
    );
    try {
      representar(<Aplicacion />);
      await usuario.click(
        pantalla.getByRole("button", { name: "Abrir configuración" }),
      );
      await usuario.type(
        pantalla.getByLabelText("Clave de API"),
        "clave-prueba",
      );
      await usuario.click(
        pantalla.getByRole("button", { name: "Cargar modelos" }),
      );
      await usuario.selectOptions(
        pantalla.getByLabelText("Modelo"),
        "modelo-prueba",
      );
      await usuario.click(pantalla.getByRole("button", { name: "Comprobar" }));
      esperar(
        await pantalla.findByText("Conexión verificada"),
      ).toBeInTheDocument();
      esperar(pantalla.getByText("API conectada")).toBeInTheDocument();
      await usuario.type(pantalla.getByLabelText("Clave de API"), "nueva");
      esperar(pantalla.queryByText("API conectada")).not.toBeInTheDocument();
    } finally {
      peticion.mockRestore();
    }
  },
);

prueba("la configuración no muestra la calculadora independiente", async () => {
  representar(<Aplicacion />);
  await usuario.click(pantalla.getByRole("button", { name: "Abrir configuración" }));
  esperar(pantalla.getByLabelText("Clave de API")).toBeInTheDocument();
  esperar(pantalla.queryByRole("tab", { name: "Calculadora de costos" })).not.toBeInTheDocument();
});

prueba(
  "el móvil permite buscar y cerrar el explorador con Escape",
  async () => {
    simular.stubGlobal("innerWidth", 390);
    try {
      representar(<Aplicacion />);
      await usuario.click(
        pantalla.getByRole("button", { name: "Abrir búsqueda" }),
      );
      esperar(
        pantalla.getByRole("textbox", { name: "Buscar evaluaciones" }),
      ).toHaveFocus();
      await usuario.keyboard("{Escape}");
      const menu = pantalla.getByRole("button", {
        name: "Alternar explorador",
      });
      await usuario.click(menu);
      esperar(
        pantalla.getByRole("dialog", { name: "Explorador académico" }),
      ).toBeInTheDocument();
      esperar(
        pantalla.getByRole("button", { name: "Cerrar panel" }),
      ).toHaveFocus();
      actuar(() => window.dispatchEvent(new Event("resize")));
      esperar(
        pantalla.getByRole("dialog", { name: "Explorador académico" }),
      ).toBeInTheDocument();
      await usuario.keyboard("{Escape}");
      esperar(pantalla.queryByRole("dialog")).not.toBeInTheDocument();
      esperar(menu).toHaveFocus();
    } finally {
      simular.unstubAllGlobals();
    }
  },
);

prueba(
  "el menú lateral conserva biblioteca pero no el botón de preparación",
  () => {
    representar(<Aplicacion />);
    const lateral = pantalla.getByRole("complementary");
    esperar(
      dentroDe(lateral).queryByRole("button", {
        name: /Preparar evaluación|Nueva evaluación/,
      }),
    ).not.toBeInTheDocument();
    esperar(
      dentroDe(lateral).getByRole("button", { name: "Mi biblioteca" }),
    ).toBeInTheDocument();
  },
);
