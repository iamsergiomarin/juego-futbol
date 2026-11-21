/** Obras de las instalaciones del club: iniciarlas, seguirlas y aplicar sus efectos al terminar. */
import type { Transaction } from "@electric-sql/pglite";
import { NOMBRE_INSTALACION } from "@/componentes/formato";
import { costeObra, horasObra } from "@/dominio/cantera";
import { OBRAS_EDIFICIOS, type EdificioObra } from "@/dominio/reglas";
import { bdLocal } from "./bd";
import { generarHornadaClub } from "./cantera";
import { fechaJuego, publicarEvento } from "./grada";
import { movimiento } from "./liga";

export class ErrorObra extends Error {}

export interface EdificioVisto {
  tipo: EdificioObra;
  nivel: number;
  destino: number | null;
  coste: number | null;
  horas: number | null;
  /** Obra en marcha: nivel de destino y fecha de fin (hora del juego). */
  obra: { destino: number; fin: string } | null;
}

const TIPOS = Object.keys(OBRAS_EDIFICIOS.base) as EdificioObra[];

export async function edificiosConObras(clubId: string): Promise<EdificioVisto[]> {
  const bd = await bdLocal();
  const edificios = (await bd.query<{ tipo: EdificioObra; nivel: number }>("select tipo, nivel from edificios where club_id = $1", [clubId])).rows;
  const obras = (
    await bd.query<{ objetivo: string; destino: number; fin: string }>(
      `select objetivo, nivel_destino as destino, to_char(fin at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as fin from obras where club_id = $1 and estado = 'en_curso'`,
      [clubId],
    )
  ).rows;
  return TIPOS.map((tipo) => {
    const nivel = edificios.find((e) => e.tipo === tipo)?.nivel ?? 0;
    const obra = obras.find((o) => o.objetivo === `edificio:${tipo}`);
    const destino = nivel < OBRAS_EDIFICIOS.nivelMaximo ? nivel + 1 : null;
    return {
      tipo,
      nivel,
      destino,
      coste: destino ? costeObra(tipo, destino) : null,
      horas: destino ? horasObra(destino) : null,
      obra: obra ? { destino: obra.destino, fin: obra.fin } : null,
    };
  });
}

export async function iniciarObra(clubId: string, tipo: EdificioObra): Promise<void> {
  if (!TIPOS.includes(tipo)) throw new ErrorObra("Edificio desconocido.");
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    const e = (await tx.query<{ nivel: number }>("select nivel from edificios where club_id = $1 and tipo = $2::tipo_edificio", [clubId, tipo])).rows[0];
    if (!e) throw new ErrorObra("Ese edificio no existe en tu club.");
    if (e.nivel >= OBRAS_EDIFICIOS.nivelMaximo) throw new ErrorObra("Ya está al nivel máximo.");
    const enCurso = (await tx.query("select 1 from obras where club_id = $1 and objetivo = $2 and estado = 'en_curso'", [clubId, `edificio:${tipo}`])).rows.length > 0;
    if (enCurso) throw new ErrorObra("Ya hay una obra en marcha en ese edificio.");
    const destino = e.nivel + 1;
    const coste = costeObra(tipo, destino);
    const caja = (await tx.query<{ c: number }>("select dinero::float8 as c from clubes where id = $1", [clubId])).rows[0].c;
    if (caja < coste) throw new ErrorObra("No hay dinero suficiente en caja para esa obra.");
    const ahora = await fechaJuego(tx);
    const t = (await tx.query<{ id: number }>("select id from temporadas where actual")).rows[0];
    await tx.query("insert into obras (club_id, objetivo, nivel_destino, coste, inicio, fin) values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + make_interval(hours => $6))", [clubId, `edificio:${tipo}`, destino, coste, ahora, horasObra(destino)]);
    await movimiento(tx, clubId, t.id, null, `Obras: ${NOMBRE_INSTALACION[tipo].toLowerCase()} (nivel ${destino})`, -coste);
  });
}

/** Cierra las obras cuya hora ha llegado y aplica sus efectos. */
export async function terminarObras(tx: Transaction): Promise<void> {
  const ahora = await fechaJuego(tx);
  const listas = (
    await tx.query<{ id: string; club: string; objetivo: string; destino: number }>(
      "select id, club_id as club, objetivo, nivel_destino as destino from obras where estado = 'en_curso' and fin <= $1::timestamptz order by fin",
      [ahora],
    )
  ).rows;
  for (const o of listas) {
    const tipo = o.objetivo.replace("edificio:", "") as EdificioObra;
    const previo = (await tx.query<{ nivel: number }>("select nivel from edificios where club_id = $1 and tipo = $2::tipo_edificio", [o.club, tipo])).rows[0].nivel;
    await tx.query("update edificios set nivel = $3 where club_id = $1 and tipo = $2::tipo_edificio", [o.club, tipo, o.destino]);
    await tx.query("update obras set estado = 'terminada' where id = $1", [o.id]);
    if (tipo === "estadio") {
      await tx.query("update sectores_estadio set aforo = aforo + $2, nivel = greatest(nivel, $3) where club_id = $1 and sector = 'tribuna'", [o.club, OBRAS_EDIFICIOS.aforoPorNivelEstadio, o.destino]);
    }
    if (tipo === "sede") {
      await tx.query("update areas set nivel = least($2, nivel + 1) where edificio_id = (select id from edificios where club_id = $1 and tipo = 'sede') and tipo in ('direccion_deportiva', 'oficina_ojeadores')", [o.club, o.destino]);
    }
    await publicarEvento(tx, o.club, { tipo: "obra", edificio: NOMBRE_INSTALACION[tipo], nivel: o.destino });
    // Inaugurar la escuela: primera hornada al momento.
    if (tipo === "escuela_cantera" && previo === 0) await generarHornadaClub(tx, o.club, "inauguracion");
  }
}
