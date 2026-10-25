import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // La aplicación de escritorio es CommonJS (Electron).
    files: ["desktop/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "dist-escritorio/**", "next-env.d.ts", "src/servidor/migraciones.generadas.ts"]),
]);
