/**
 * Completa el servidor autónomo de Next para que funcione dentro de la
 * aplicación de escritorio: copia los ficheros estáticos y la carpeta public.
 * Se ejecuta tras `next build` (npm run build:servidor).
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const standalone = join(raiz, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  throw new Error("No existe .next/standalone/server.js: ejecuta antes `next build`.");
}
cpSync(join(raiz, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (existsSync(join(raiz, "public"))) {
  cpSync(join(raiz, "public"), join(standalone, "public"), { recursive: true });
}
console.log("Servidor autónomo listo en .next/standalone");
