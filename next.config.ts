import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor autónomo: es lo que viaja dentro de la aplicación de escritorio.
  output: "standalone",
  // PostgreSQL incrustado: se carga tal cual, con sus ficheros .wasm y .data.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@electric-sql/pglite/dist/**/*"],
  },
};

export default nextConfig;
