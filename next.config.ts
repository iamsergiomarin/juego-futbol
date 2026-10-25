import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor autónomo: es lo que viaja dentro de la aplicación de escritorio.
  output: "standalone",
  // Sin optimizador de imágenes de Next: evita empaquetar librerías nativas pesadas.
  images: { unoptimized: true },
  // PostgreSQL incrustado: se carga tal cual, con sus ficheros .wasm y .data.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@electric-sql/pglite/dist/**/*"],
  },
};

export default nextConfig;
