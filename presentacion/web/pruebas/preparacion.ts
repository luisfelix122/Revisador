import "@testing-library/jest-dom/vitest";
import { cleanup as limpiar } from "@testing-library/react";
import { afterEach as despuesDeCada } from "vitest";
despuesDeCada(() => {
  limpiar();
  sessionStorage.clear();
  localStorage.clear();
});
