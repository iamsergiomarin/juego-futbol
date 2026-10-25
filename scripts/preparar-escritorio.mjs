/**
 * Completa el servidor autónomo de Next para que funcione dentro de la
 * aplicación de escritorio. Se ejecuta tras `next build` (npm run build:servidor):
 *
 * 1. Copia los ficheros estáticos y la carpeta public.
 * 2. Sustituye los enlaces simbólicos por copias reales: Windows y el empaquetador
 *    del instalador no los siguen (Next enlaza así los paquetes externos, como PGlite).
 * 3. Quita lo que el juego no usa para aligerar el instalador.
 */
import { cpSync, existsSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
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

let enlaces = 0;
function resolverEnlaces(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    const info = lstatSync(ruta);
    if (info.isSymbolicLink()) {
      const destino = realpathSync(ruta);
      rmSync(ruta, { recursive: true, force: true });
      cpSync(destino, ruta, { recursive: true, dereference: true });
      enlaces++;
    } else if (info.isDirectory()) {
      resolverEnlaces(ruta);
    }
  }
}
resolverEnlaces(standalone);

// Extensiones de PostgreSQL que el juego no carga (se pueden recuperar si alguna hace falta).
let extensiones = 0;
function quitarExtensiones(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    const info = lstatSync(ruta);
    if (info.isDirectory()) quitarExtensiones(ruta);
    else if (nombre.endsWith(".tar.gz") && carpeta.includes("pglite")) {
      rmSync(ruta);
      extensiones++;
    }
  }
}
quitarExtensiones(standalone);

// Librería nativa de imágenes de Next: el juego no usa su optimizador (images.unoptimized).
for (const paquete of ["@img", "sharp"]) {
  rmSync(join(standalone, "node_modules", paquete), { recursive: true, force: true });
}

console.log(`Servidor autónomo listo en .next/standalone (${enlaces} enlaces resueltos, ${extensiones} extensiones quitadas)`);
