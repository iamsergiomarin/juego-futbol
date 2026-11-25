/** Filial: liga propia de domingos, plantilla del filial y reglas de fichas con el primer equipo. */
import type { Transaction } from "@electric-sql/pglite";
import { crearRng, simularPartido, semillaAleatoria } from "@/motor";
import { desarrollarJuvenil } from "@/dominio/cantera";
import { armarFilial, calendarioFilial, fechaDomingo, mediaFilialBot, type JugadorFilial } from "@/dominio/filial";
import { MERCADO_LOCAL } from "@/dominio/mercado";
import { FILIAL } from "@/dominio/reglas";
import { bdLocal } from "./bd";
import { publicarNoticia } from "./noticias";

export class ErrorFilial extends Error {}

type Consulta = Pick<Transaction, "query">;

// -----------------------------------------------------------------------------
// Calendario y jornadas
// -----------------------------------------------------------------------------

/** Una vuelta por grupo, los domingos a las 12:00. Idempotente. */
export async function crearCalendarioFilial(tx: Transaction): Promise<void> {
  const t = (await tx.query<{ id: number; inicio: string }>("select id, to_char(inicio, 'YYYY-MM-DD') as inicio from temporadas where actual")).rows[0];
  if (!t) return;
  const grupos = (await tx.query<{ id: number }>("select g.id from grupos g where g.abierto and not exists (select 1 from partidos_filial f where f.grupo_id = g.id and f.temporada_id = $1)", [t.id])).rows;
  for (const g of grupos) {
    const clubes = (await tx.query<{ id: string }>("select id from clubes where grupo_id = $1 order by id", [g.id])).rows.map((r) => r.id);
    if (clubes.length % 2 !== 0 || clubes.length < 4) continue;
    const rng = crearRng(semillaAleatoria());
    for (const e of calendarioFilial(clubes, rng)) {
      await tx.query(
        "insert into partidos_filial (temporada_id, grupo_id, jornada, local_id, visitante_id, inicio, semilla) values ($1, $2, $3, $4, $5, ($6::timestamp at time zone 'Europe/Madrid'), $7)",
        [t.id, g.id, e.jornada, e.local, e.visitante, `${fechaDomingo(t.inicio, e.jornada)} 12:00`, Math.floor(rng() * 2 ** 31)],
      );
    }
  }
}

async function nivelEscuela(bd: Consulta, clubId: string): Promise<number> {
  return (await bd.query<{ n: number }>("select coalesce(nivel, 0)::int as n from edificios where club_id = $1 and tipo = 'escuela_cantera'", [clubId])).rows[0]?.n ?? 0;
}

async function equipoFilial(tx: Transaction, clubId: string, semilla: number) {
  const c = (await tx.query<{ nombre: string; humano: boolean; media: number | null }>(
    "select c.nombre, c.manager_id is not null as humano, (select avg(media)::float8 from jugadores j where j.club_id = c.id and not j.retirado) as media from clubes c where c.id = $1",
    [clubId],
  )).rows[0];
  const rng = crearRng(semilla);
  const mediaClub = c.media ?? 3.5;
  const propio = c.humano && (await nivelEscuela(tx, clubId)) >= FILIAL.nivelEscuelaMinimo;
  const reales: JugadorFilial[] = propio
    ? (await tx.query<{ id: string; nombre: string; apellido: string; posicion: JugadorFilial["posicion"]; atributos: Record<string, number>; media: number }>(
        "select id, nombre, apellido, posicion, atributos, media::float8 as media from juveniles where club_id = $1 and estado = 'filial'", [clubId])).rows
        .map((j) => ({ id: j.id, nombre: `${j.nombre} ${j.apellido}`, posicion: j.posicion, atributos: j.atributos, media: j.media }))
    : [];
  const nivel = propio ? mediaClub - FILIAL.descuentoRelleno : mediaFilialBot(mediaClub, rng);
  return { ...armarFilial(rng, clubId, `${c.nombre} B`, reales, nivel), humano: c.humano, propio, nombre: c.nombre };
}

/** Juega la jornada de filiales de la semana. Los juveniles que juegan ganan minutos y se desarrollan más deprisa. */
export async function jugarFilial(tx: Transaction, jornada: number): Promise<void> {
  const t = (await tx.query<{ id: number }>("select id from temporadas where actual")).rows[0];
  const partidos = (await tx.query<{ id: string; local: string; visitante: string; semilla: number }>(
    "select id, local_id as local, visitante_id as visitante, semilla from partidos_filial where temporada_id = $1 and jornada = $2 and estado = 'pendiente'", [t.id, jornada])).rows;
  for (const p of partidos) {
    const [l, v] = [await equipoFilial(tx, p.local, p.semilla), await equipoFilial(tx, p.visitante, p.semilla + 1)];
    const r = simularPartido(l.equipo, v.equipo, p.semilla);
    await tx.query("update partidos_filial set estado = 'finalizado', goles_local = $2, goles_visitante = $3 where id = $1", [p.id, r.goles[0], r.goles[1]]);
    const jugaron = new Set(r.participantes);
    for (const [i, x] of [l, v].entries()) {
      const reales = x.juegan.filter((id) => jugaron.has(id));
      if (!x.propio || !x.humano) continue;
      const nivel = await nivelEscuela(tx, i === 0 ? p.local : p.visitante);
      for (const id of reales) {
        const j = (await tx.query<{ atributos: Record<string, number>; potencial: number; edad: number }>(
          "select atributos, potencial, date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad from juveniles where id = $1", [id])).rows[0];
        let atributos = j.atributos;
        let media = 0;
        for (let k = 0; k < FILIAL.pasosPorPartido; k++) ({ atributos, media } = desarrollarJuvenil(atributos, j.potencial, j.edad, Math.max(1, nivel)));
        await tx.query("update juveniles set atributos = $2::jsonb, media = $3, partidos_filial = partidos_filial + 1 where id = $1", [id, JSON.stringify(atributos), media]);
      }
      const [a, b] = i === 0 ? [r.goles[0], r.goles[1]] : [r.goles[1], r.goles[0]];
      const rival = i === 0 ? v.nombre : l.nombre;
      const veredicto = a > b ? "Victoria" : a === b ? "Empate" : "Derrota";
      await publicarNoticia(tx, i === 0 ? p.local : p.visitante, "partido", `Informe del analista: filial ${a}-${b}`,
        `${veredicto} del filial ante ${rival} (${a}-${b}). Han jugado ${reales.length} juveniles propios y ${x.relleno} jóvenes de la zona para completar el once y el banquillo.`, jornada);
    }
  }
}

// -----------------------------------------------------------------------------
// Lecturas
// -----------------------------------------------------------------------------

export interface FilaFilial {
  id: string;
  nombre: string;
  propio: boolean;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  puntos: number;
}

export interface JugadorFilialVisto {
  id: string;
  nombre: string;
  apellido: string;
  edad: number;
  posicion: "POR" | "DEF" | "MED" | "DEL";
  media: number;
  partidos: number;
  /** Puede subir al primer equipo sin ocupar ficha. */
  sinFicha: boolean;
}

export interface PideFicha {
  id: string;
  nombre: string;
  edad: number;
  media: number;
  partidos: number;
}

export interface PartidoFilialVisto {
  jornada: number;
  fecha: string;
  local: string;
  visitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
}

export async function datosFilial(clubId: string) {
  const bd = await bdLocal();
  const nivel = await nivelEscuela(bd, clubId);
  const tabla = (await bd.query<FilaFilial>(
    `with p as (
       select local_id as c, goles_local as gf, goles_visitante as gc from partidos_filial
        where temporada_id = (select id from temporadas where actual) and grupo_id = (select grupo_id from clubes where id = $1) and estado = 'finalizado'
       union all
       select visitante_id, goles_visitante, goles_local from partidos_filial
        where temporada_id = (select id from temporadas where actual) and grupo_id = (select grupo_id from clubes where id = $1) and estado = 'finalizado')
     select c.id, c.nombre, c.id = $1 as propio, count(p.c)::int as jugados,
            count(*) filter (where p.gf > p.gc)::int as ganados, count(*) filter (where p.gf = p.gc)::int as empatados, count(*) filter (where p.gf < p.gc)::int as perdidos,
            coalesce(sum(p.gf), 0)::int as "golesFavor", coalesce(sum(p.gc), 0)::int as "golesContra",
            (count(*) filter (where p.gf > p.gc) * 3 + count(*) filter (where p.gf = p.gc))::int as puntos
       from clubes c left join p on p.c = c.id where c.grupo_id = (select grupo_id from clubes where id = $1)
      group by c.id, c.nombre order by puntos desc, coalesce(sum(p.gf), 0) - coalesce(sum(p.gc), 0) desc, coalesce(sum(p.gf), 0) desc, c.nombre`, [clubId])).rows;
  const plantilla = (await bd.query<JugadorFilialVisto & { edad: number }>(
    `select id, nombre, apellido, posicion, media::float8 as media, partidos_filial as partidos,
            date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad, true as "sinFicha"
       from juveniles where club_id = $1 and estado = 'filial' order by media desc`, [clubId])).rows
    .map((j) => ({ ...j, sinFicha: j.edad < FILIAL.edadSinFicha }));
  const sinFicha = (await bd.query<PideFicha & { ficha: string }>(
    `select id, nombre || ' ' || apellido as nombre, media::float8 as media, partidos_primer_equipo_temporada as partidos, ficha,
            date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad
       from jugadores where club_id = $1 and ficha = 'filial' and not retirado order by media desc`, [clubId])).rows;
  const partidos = (await bd.query<PartidoFilialVisto>(
    `select f.jornada, to_char(f.inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as fecha, l.nombre as local, v.nombre as visitante,
            f.goles_local as "golesLocal", f.goles_visitante as "golesVisitante"
       from partidos_filial f join clubes l on l.id = f.local_id join clubes v on v.id = f.visitante_id
      where f.temporada_id = (select id from temporadas where actual) and (f.local_id = $1 or f.visitante_id = $1) order by f.jornada`, [clubId])).rows;
  const fichasPrimerEquipo = (await bd.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado", [clubId])).rows[0].n;
  return {
    nivel,
    tabla,
    plantilla,
    sinFicha: sinFicha.map((j) => ({ ...j, pide: j.partidos >= FILIAL.partidosParaFicha || j.edad >= FILIAL.edadSinFicha })),
    partidos,
    fichasPrimerEquipo,
  };
}

// -----------------------------------------------------------------------------
// Acciones del mánager
// -----------------------------------------------------------------------------

/** De la academia al filial. */
export async function pasarAlFilial(clubId: string, juvenilId: string): Promise<void> {
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    if ((await nivelEscuela(tx, clubId)) < FILIAL.nivelEscuelaMinimo) throw new ErrorFilial("Necesitas la escuela de cantera para tener filial.");
    const j = (await tx.query<{ edad: number }>(
      "select date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad from juveniles where id = $1 and club_id = $2 and estado = 'academia'", [juvenilId, clubId])).rows[0];
    if (!j) throw new ErrorFilial("Ese juvenil ya no está en la academia.");
    if (j.edad < FILIAL.edadMinima) throw new ErrorFilial(`Hay que tener ${FILIAL.edadMinima} años para jugar en el filial.`);
    const n = (await tx.query<{ n: number }>("select count(*)::int as n from juveniles where club_id = $1 and estado = 'filial'", [clubId])).rows[0].n;
    if (n >= FILIAL.maximoPlantilla) throw new ErrorFilial(`El filial está completo (${FILIAL.maximoPlantilla} jugadores).`);
    await tx.query("update juveniles set estado = 'filial' where id = $1", [juvenilId]);
  });
}

/** Vuelve a la academia. */
export async function volverALaAcademia(clubId: string, juvenilId: string): Promise<void> {
  const bd = await bdLocal();
  const r = await bd.query("update juveniles set estado = 'academia' where id = $1 and club_id = $2 and estado = 'filial'", [juvenilId, clubId]);
  if (r.affectedRows === 0) throw new ErrorFilial("Ese jugador ya no está en el filial.");
}

/** Un jugador que juega arriba sin ficha recibe su ficha del primer equipo. */
export async function darFicha(clubId: string, jugadorId: string): Promise<string> {
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const j = (await tx.query<{ nombre: string }>("select nombre || ' ' || apellido as nombre from jugadores where id = $1 and club_id = $2 and ficha = 'filial' for update", [jugadorId, clubId])).rows[0];
    if (!j) throw new ErrorFilial("Ese jugador ya tiene ficha o no es del club.");
    const n = (await tx.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado", [clubId])).rows[0].n;
    if (n >= MERCADO_LOCAL.maximoPlantilla) throw new ErrorFilial(`La plantilla está completa (${MERCADO_LOCAL.maximoPlantilla} fichas).`);
    await tx.query("update jugadores set ficha = 'primer_equipo' where id = $1", [jugadorId]);
    return j.nombre;
  });
}

/**
 * Fin de temporada: quien llega a 10 partidos con el primer equipo o cumple 22 años necesita ficha. Si hay hueco, la recibe;
 * si no, el club no puede retenerlo y se marcha. Los demás siguen jugando arriba sin ficha y los contadores empiezan de cero.
 */
export async function cerrarFichasFilial(tx: Transaction, clubId: string, temporada: { id: number }): Promise<void> {
  const piden = (await tx.query<{ id: string; nombre: string }>(
    `select id, nombre || ' ' || apellido as nombre from jugadores
      where club_id = $1 and ficha = 'filial' and not retirado
        and (partidos_primer_equipo_temporada >= $2 or date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento)) >= $3)
      order by media desc`, [clubId, FILIAL.partidosParaFicha, FILIAL.edadSinFicha])).rows;
  let fichas = (await tx.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado", [clubId])).rows[0].n;
  for (const j of piden) {
    if (fichas < MERCADO_LOCAL.maximoPlantilla) {
      await tx.query("update jugadores set ficha = 'primer_equipo' where id = $1", [j.id]);
      fichas++;
      await publicarNoticia(tx, clubId, "contrato", `${j.nombre} recibe ficha del primer equipo`, `Había jugado lo suficiente arriba y el club le ha dado ficha. La plantilla queda en ${fichas} fichas.`, null);
    } else {
      await tx.query("update jugadores set club_id = null, ficha = 'primer_equipo', precio_venta = null where id = $1", [j.id]);
      await publicarNoticia(tx, clubId, "contrato", `${j.nombre} se marcha del club`, "No había ficha libre en el primer equipo y no podía volver al filial: queda libre.", null);
    }
  }
  await tx.query("update jugadores set partidos_primer_equipo_temporada = 0 where club_id = $1", [clubId]);
  void temporada;
}
