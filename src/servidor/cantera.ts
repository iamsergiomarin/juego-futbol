/** Cantera: hornadas, desarrollo de los juveniles, contrato profesional y salida. */
import type { Transaction } from "@electric-sql/pglite";
import { crearRng, semillaAleatoria } from "@/motor";
import { desarrollarJuvenil, estaListo, generarHornada } from "@/dominio/cantera";
import { CANTERA_JUEGO, FILIAL, type NivelDivision } from "@/dominio/reglas";
import { MERCADO_LOCAL, salarioReferencia, valorJugador } from "@/dominio/mercado";
import { bdLocal } from "./bd";
import { publicarEvento } from "./grada";
import { nombreJugador } from "@/dominio/nombres";

export class ErrorCantera extends Error {}

export type Momento = "pretemporada" | "mitad" | "inauguracion";

export interface JuvenilVisto {
  id: string;
  nombre: string;
  apellido: string;
  edad: number;
  posicion: "POR" | "DEF" | "MED" | "DEL";
  media: number;
  proyeccion: "Excepcional" | "Alta" | "Media" | "Baja";
  listo: boolean;
  sale: boolean;
}

async function nivelEscuela(tx: Pick<Transaction, "query">, clubId: string): Promise<number> {
  return (await tx.query<{ n: number }>("select coalesce(nivel, 0)::int as n from edificios where club_id = $1 and tipo = 'escuela_cantera'", [clubId])).rows[0]?.n ?? 0;
}

/** Una hornada para un club (solo una por momento y temporada). Devuelve cuántos juveniles llegan. */
export async function generarHornadaClub(tx: Transaction, clubId: string, momento: Momento): Promise<number> {
  const nivel = await nivelEscuela(tx, clubId);
  if (nivel < 1) return 0;
  const t = (await tx.query<{ id: number; inicio: string }>("select id, inicio::text as inicio from temporadas where actual")).rows[0];
  const ya = (await tx.query("select 1 from juveniles where club_id = $1 and temporada_id = $2 and hornada = $3", [clubId, t.id, momento])).rows.length > 0;
  if (ya) return 0;
  const club = (
    await tx.query<{ media: number | null; popularidad: number; division: NivelDivision; nombre: string }>(
      `select (select avg(media)::float8 from jugadores j where j.club_id = c.id and not j.retirado) as media, c.popularidad::float8 as popularidad, g.division, c.nombre
         from clubes c join grupos g on g.id = c.grupo_id where c.id = $1`,
      [clubId],
    )
  ).rows[0];
  const rng = crearRng(semillaAleatoria());
  const hornada = generarHornada(rng, { nivelEscuela: nivel, mediaEquipo: club.media ?? 3.5, popularidad: club.popularidad });
  const inicio = new Date(t.inicio);
  const usados = new Set((await tx.query<{ n: string }>("select nombre || ' ' || apellido as n from jugadores where club_id = $1 union select nombre || ' ' || apellido from juveniles where club_id = $1 and estado = 'academia'", [clubId])).rows.map((r) => r.n));
  let joya: string | null = null;
  for (const j of hornada) {
    let id = nombreJugador(rng);
    for (let i = 0; usados.has(`${id.nombre} ${id.apellido}`) && i < 20; i++) id = nombreJugador(rng);
    usados.add(`${id.nombre} ${id.apellido}`);
    const nacimiento = new Date(inicio);
    nacimiento.setUTCFullYear(nacimiento.getUTCFullYear() - j.edad);
    nacimiento.setUTCDate(nacimiento.getUTCDate() - Math.floor(rng() * 365));
    await tx.query(
      `insert into juveniles (club_id, temporada_id, hornada, nombre, apellido, fecha_nacimiento, posicion, atributos, media, potencial, joya)
       values ($1, $2, $3, $4, $5, $6, $7::posicion, $8::jsonb, $9, $10, $11)`,
      [clubId, t.id, momento, id.nombre, id.apellido, nacimiento.toISOString().slice(0, 10), j.posicion, JSON.stringify(j.atributos), j.media, j.potencial, j.joya],
    );
    if (j.joya && !joya) joya = `${id.nombre} ${id.apellido}`;
  }
  await publicarEvento(tx, clubId, { tipo: "cantera", cantidad: hornada.length, joya, momento });
  return hornada.length;
}

/** Hornada de todos los clubes con mánager (pretemporada o mitad de curso). */
export async function generarHornadas(tx: Transaction, momento: Momento): Promise<void> {
  const clubes = (await tx.query<{ id: string }>("select c.id from clubes c join grupos g on g.id = c.grupo_id where g.abierto and c.manager_id is not null")).rows;
  for (const c of clubes) await generarHornadaClub(tx, c.id, momento);
}

/** Cada semana los juveniles se acercan a su potencial. */
export async function desarrollarJuveniles(tx: Transaction): Promise<void> {
  const filas = (
    await tx.query<{ id: string; club: string; atributos: Record<string, number>; potencial: number; edad: number }>(
      `select id, club_id as club, atributos, potencial,
              date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad
         from juveniles where estado = 'academia'`,
    )
  ).rows;
  const niveles = new Map<string, number>();
  for (const f of filas) {
    if (!niveles.has(f.club)) niveles.set(f.club, await nivelEscuela(tx, f.club));
    const r = desarrollarJuvenil(f.atributos, f.potencial, f.edad, niveles.get(f.club) || 1);
    await tx.query("update juveniles set atributos = $2::jsonb, media = $3 where id = $1", [f.id, JSON.stringify(r.atributos), r.media]);
  }
}

/** Nueva temporada: los que han cumplido la edad de salida sin contrato se marchan. Devuelve cuántos. */
export async function liberarMayores(tx: Transaction, clubId: string): Promise<number> {
  const r = await tx.query(
    `update juveniles set estado = 'liberado'
      where club_id = $1 and estado = 'academia'
        and date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento)) >= $2`,
    [clubId, CANTERA_JUEGO.edadSalida],
  );
  return r.affectedRows ?? 0;
}

export async function juvenilesDelClub(clubId: string): Promise<{ juveniles: JuvenilVisto[]; nivel: number; mediaEquipo: number; plantilla: number }> {
  const bd = await bdLocal();
  const nivel = await nivelEscuela(bd, clubId);
  const mediaEquipo = (await bd.query<{ m: number | null }>("select avg(media)::float8 as m from jugadores where club_id = $1 and not retirado", [clubId])).rows[0].m ?? 3.5;
  const plantilla = (await bd.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado", [clubId])).rows[0].n;
  const filas = (
    await bd.query<{ id: string; nombre: string; apellido: string; posicion: JuvenilVisto["posicion"]; media: number; potencial: number; edad: number }>(
      `select id, nombre, apellido, posicion, media::float8 as media, potencial,
              date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad
         from juveniles where club_id = $1 and estado = 'academia' order by media desc`,
      [clubId],
    )
  ).rows;
  return {
    nivel,
    mediaEquipo,
    plantilla,
    juveniles: filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      apellido: f.apellido,
      edad: f.edad,
      posicion: f.posicion,
      media: f.media,
      proyeccion: f.potencial >= 85 ? "Excepcional" : f.potencial >= 70 ? "Alta" : f.potencial >= 55 ? "Media" : "Baja",
      listo: estaListo(f.media, mediaEquipo),
      sale: f.edad + 1 >= CANTERA_JUEGO.edadSalida,
    })),
  };
}

/** Contrato profesional: el juvenil pasa al primer equipo con su club como formador. */
export async function subirJuvenil(clubId: string, juvenilId: string, sinFicha = false): Promise<string> {
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const j = (
      await tx.query<{ nombre: string; apellido: string; posicion: string; atributos: Record<string, number>; media: number; potencial: number; personalidad: string; joya: boolean; nacimiento: string; edad: number; estado: string }>(
        `select nombre, apellido, posicion, atributos, media::float8 as media, potencial, personalidad, joya, fecha_nacimiento::text as nacimiento,
                date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad, estado
           from juveniles where id = $1 and club_id = $2 and estado in ('academia', 'filial') for update`,
        [juvenilId, clubId],
      )
    ).rows[0];
    if (!j) throw new ErrorCantera("Ese juvenil ya no está en la academia.");
    if (sinFicha) {
      if (j.estado !== "filial") throw new ErrorCantera("Solo los jugadores del filial suben sin ficha.");
      if (j.edad >= FILIAL.edadSinFicha) throw new ErrorCantera(`Con ${FILIAL.edadSinFicha} años o más necesita ficha del primer equipo.`);
      const arriba = (await tx.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'filial' and not retirado", [clubId])).rows[0].n;
      if (arriba >= FILIAL.maximoSinFicha) throw new ErrorCantera(`Ya hay ${FILIAL.maximoSinFicha} jugadores del filial jugando arriba sin ficha.`);
    }
    const plantilla = (await tx.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado", [clubId])).rows[0].n;
    if (!sinFicha && plantilla >= MERCADO_LOCAL.maximoPlantilla) throw new ErrorCantera(`La plantilla está completa (${MERCADO_LOCAL.maximoPlantilla} fichas).`);
    const c = (await tx.query<{ numero: number; division: NivelDivision }>("select t.numero, g.division from temporadas t, clubes c join grupos g on g.id = c.grupo_id where t.actual and c.id = $1", [clubId])).rows[0];
    const atributos = Object.fromEntries(Object.entries(j.atributos).map(([k, v]) => [k, Math.max(1, Math.min(100, Math.round(v)))]));
    const dorsal = (await tx.query<{ d: number }>("select min(n)::int as d from generate_series(2, 99) n where n <> 13 and not exists (select 1 from jugadores where club_id = $1 and dorsal = n)", [clubId])).rows[0].d;
    await tx.query(
      `insert into jugadores (club_id, nombre, apellido, fecha_nacimiento, posicion, atributos, media, potencial, personalidad, ficha, contrato_hasta, salario, valor_mercado, dorsal, club_formador)
       values ($1, $2, $3, $4, $5::posicion, $6::jsonb, $7, $8, $9::personalidad, $14::tipo_ficha, $10, $11, $12, $13, $1)`,
      [clubId, j.nombre, j.apellido, j.nacimiento, j.posicion, JSON.stringify(atributos), j.media, j.potencial, j.personalidad, c.numero + 2, salarioReferencia(j.media, c.division), valorJugador(j.media, j.edad), dorsal, sinFicha ? "filial" : "primer_equipo"],
    );
    await tx.query("update juveniles set estado = 'subido' where id = $1", [juvenilId]);
    await tx.query("update clubes set popularidad = least(100, popularidad + 1) where id = $1", [clubId]);
    const nombre = `${j.nombre} ${j.apellido}`;
    await publicarEvento(tx, clubId, { tipo: "canterano", jugador: nombre, media: j.media, edad: j.edad, joya: j.joya });
    return nombre;
  });
}

export async function liberarJuvenil(clubId: string, juvenilId: string): Promise<void> {
  const bd = await bdLocal();
  const r = await bd.query("update juveniles set estado = 'liberado' where id = $1 and club_id = $2 and estado = 'academia'", [juvenilId, clubId]);
  if (r.affectedRows === 0) throw new ErrorCantera("Ese juvenil ya no está en la academia.");
}

