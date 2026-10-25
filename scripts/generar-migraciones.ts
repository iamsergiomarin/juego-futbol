/**
 * Copia las migraciones SQL a un módulo TypeScript para que viajen dentro del
 * servidor empaquetado (aplicación de escritorio) sin depender de rutas de disco.
 * Se ejecuta antes de cada build (npm run build).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const carpeta = join(process.cwd(), "supabase", "migrations");
const migraciones = readdirSync(carpeta)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((nombre) => ({ nombre, sql: readFileSync(join(carpeta, nombre), "utf8") }));

const salida = `// Generado por scripts/generar-migraciones.ts. No editar a mano.
export const MIGRACIONES: { nombre: string; sql: string }[] = ${JSON.stringify(migraciones, null, 2)};
`;
writeFileSync(join(process.cwd(), "src", "servidor", "migraciones.generadas.ts"), salida);
console.log(`Migraciones empaquetadas: ${migraciones.map((m) => m.nombre).join(", ")}`);
