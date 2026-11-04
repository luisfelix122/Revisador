import { defineConfig as definirConfiguracion } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default definirConfiguracion({
  plugins: [react(), tailwind()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./presentacion/web/pruebas/preparacion.ts"],
    testTimeout: 20000,
  },
});
