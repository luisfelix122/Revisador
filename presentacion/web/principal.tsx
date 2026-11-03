import { StrictMode as ModoEstricto } from "react";
import { createRoot as crearRaiz } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import { Revisador } from "./Revisador";
import "./estilos.css";

crearRaiz(document.getElementById("raiz")!).render(
  <ModoEstricto>
    <Revisador />
  </ModoEstricto>,
);
