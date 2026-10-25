import { PGlite } from "@electric-sql/pglite";
import { MIGRACIONES } from "./migraciones.generadas";

/**
 * Base de datos.
 *
 * - Modo local (aplicación de escritorio y desarrollo): PostgreSQL incrustado (PGlite)
 *   guardado en la carpeta indicada por DATOS_LOCALES. Usa las mismas migraciones que Supabase.
 * - Modo online: Supabase (pendiente de conectar).
 */

/** Sustituye lo que Supabase da hecho: el esquema auth con sus usuarios. */
const PREPARACION_LOCAL = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.manager_id', true), '')::uuid
$$;
create table if not exists _migraciones (
  nombre text primary key,
  aplicada_en timestamptz not null default now()
);
`;

export function modoLocal(): boolean {
  return Boolean(process.env.DATOS_LOCALES);
}

const cache = globalThis as unknown as { __bdLocal?: Promise<PGlite> };

async function abrirLocal(carpeta: string): Promise<PGlite> {
  const bd = await PGlite.create(carpeta === "memoria" ? undefined : carpeta);
  await bd.exec(PREPARACION_LOCAL);
  const aplicadas = new Set(
    (await bd.query<{ nombre: string }>("select nombre from _migraciones")).rows.map((r) => r.nombre),
  );
  for (const m of MIGRACIONES) {
    if (aplicadas.has(m.nombre)) continue;
    await bd.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query("insert into _migraciones (nombre) values ($1)", [m.nombre]);
    });
  }
  return bd;
}

/** Abre (y migra la primera vez) la base de datos local. Una sola instancia por proceso. */
export function bdLocal(): Promise<PGlite> {
  const carpeta = process.env.DATOS_LOCALES;
  if (!carpeta) throw new Error("DATOS_LOCALES no está definido: no hay base de datos local.");
  cache.__bdLocal ??= abrirLocal(carpeta).catch((e) => {
    cache.__bdLocal = undefined;
    throw e;
  });
  return cache.__bdLocal;
}

export interface EstadoBd {
  tablas: number;
  migraciones: string[];
}

export async function estadoBdLocal(): Promise<EstadoBd> {
  const bd = await bdLocal();
  const tablas = await bd.query<{ n: number }>(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name <> '_migraciones'",
  );
  const migraciones = await bd.query<{ nombre: string }>("select nombre from _migraciones order by nombre");
  return { tablas: tablas.rows[0].n, migraciones: migraciones.rows.map((r) => r.nombre) };
}
