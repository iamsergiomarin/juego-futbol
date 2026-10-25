import type { Transaction } from "@electric-sql/pglite";
import { crearRng, mediaJugador, semillaAleatoria, uniforme } from "@/motor";
import { valorJugador } from "@/dominio/mercado";
import { BOTS, LIGA, division, type NivelDivision } from "@/dominio/reglas";
import { MERCADO_LOCAL } from "@/dominio/mercado";
import { bdLocal } from "./bd";
import { asegurarCalendario, movimiento } from "./liga";
import { generarAgentesLibres, insertarClubBot, isoFecha, nombresUsados, proximoLunes } from "./mundo";
import { publicarNoticia } from "./noticias";

/** Prima de ascenso: fracción del presupuesto de la nueva división. */
const PRIMA_ASCENSO = 0.2;

interface PartidoPlayoff {
  id: string;
  ronda: string;
  jornada: number;
  inicio: string;
  local: string;
  visitante: string;
  ganador: string | null;
}

async function ultimaFecha(tx: Transaction, temporadaId: number): Promise<Date> {
  const r = (await tx.query<{ f: string }>("select to_char(max(inicio) at time zone 'Europe/Madrid', 'YYYY-MM-DD') as f from partidos where temporada_id = $1", [temporadaId])).rows[0];
  return new Date(`${r.f}T12:00:00Z`);
}

async function crearPartido(tx: Transaction, temporadaId: number, grupo: number, ronda: string, jornada: number, fecha: Date, local: string, visitante: string) {
  await tx.query(
    `insert into partidos (temporada_id, competicion, grupo_id, jornada, ronda, local_id, visitante_id, inicio, semilla)
     values ($1, 'playoff', $2, $3, $4, $5, $6, ($7::timestamp at time zone 'Europe/Madrid'), $8)`,
    [temporadaId, grupo, jornada, ronda, local, visitante, `${isoFecha(fecha)} 21:00`, Math.floor(Math.random() * 2 ** 31)],
  );
}

/** Al acabar la liga: semifinales del playoff (2.º contra 5.º y 3.º contra 4.º) en cada grupo abierto. */
export async function crearPlayoff(tx: Transaction, temporadaId: number): Promise<void> {
  const fecha = await ultimaFecha(tx, temporadaId);
  fecha.setUTCDate(fecha.getUTCDate() + 2);
  const grupos = (await tx.query<{ id: number }>("select id from grupos where abierto")).rows;
  for (const g of grupos) {
    const tabla = await clasificacionGrupo(tx, temporadaId, g.id);
    if (tabla.length < 5) continue;
    await crearPartido(tx, temporadaId, g.id, "Semifinal", LIGA.jornadas + 1, fecha, tabla[1], tabla[4]);
    await crearPartido(tx, temporadaId, g.id, "Semifinal", LIGA.jornadas + 1, fecha, tabla[2], tabla[3]);
    for (const [i, club] of tabla.entries()) {
      if (i === 0) await publicarNoticia(tx, club, "temporada", "¡Campeones del grupo!", "Primer puesto: ascenso directo a la siguiente división.", LIGA.jornadas);
      else if (i <= 4) await publicarNoticia(tx, club, "temporada", "A jugar el playoff de ascenso", `Terminamos ${i + 1}.º. Semifinal a partido único: el mejor clasificado juega en casa.`, LIGA.jornadas);
    }
  }
  await tx.query("update temporadas set fase = 'playoff' where id = $1", [temporadaId]);
}

async function clasificacionGrupo(tx: Transaction, temporadaId: number, grupo: number): Promise<string[]> {
  return (
    await tx.query<{ id: string }>(
      `select k.club_id as id from clasificacion k join clubes c on c.id = k.club_id
        where k.temporada_id = $1 and k.grupo_id = $2
        order by k.puntos desc, (k.goles_favor - k.goles_contra) desc, k.goles_favor desc, c.nombre`,
      [temporadaId, grupo],
    )
  ).rows.map((r) => r.id);
}

async function partidosPlayoff(tx: Transaction, temporadaId: number, grupo: number): Promise<PartidoPlayoff[]> {
  return (
    await tx.query<PartidoPlayoff>(
      `select id, ronda, jornada, inicio::text as inicio, local_id as local, visitante_id as visitante, ganador_id as ganador
         from partidos where temporada_id = $1 and grupo_id = $2 and competicion = 'playoff' order by jornada, id`,
      [temporadaId, grupo],
    )
  ).rows;
}

/** Tras cada ronda del playoff: final, cruce con el campeón del playoff del grupo hermano y cierre. */
export async function avanzarPlayoff(tx: Transaction, temporadaId: number): Promise<void> {
  const grupos = (await tx.query<{ id: number; division: number }>("select id, division from grupos where abierto")).rows;
  let pendiente = false;
  for (const g of grupos) {
    const partidos = await partidosPlayoff(tx, temporadaId, g.id);
    if (partidos.length === 0) continue;
    if (partidos.some((p) => !p.ganador)) {
      pendiente = true;
      continue;
    }
    const tabla = await clasificacionGrupo(tx, temporadaId, g.id);
    const puesto = (id: string) => tabla.indexOf(id);
    const fecha = await ultimaFecha(tx, temporadaId);
    const semis = partidos.filter((p) => p.ronda === "Semifinal");
    const final = partidos.find((p) => p.ronda === "Final");
    const cruce = partidos.find((p) => p.ronda === "Cruce de ascenso");
    if (!final) {
      const [a, b] = semis.map((p) => p.ganador!).sort((x, y) => puesto(x) - puesto(y));
      fecha.setUTCDate(fecha.getUTCDate() + 5);
      await crearPartido(tx, temporadaId, g.id, "Final", LIGA.jornadas + 2, fecha, a, b);
      pendiente = true;
    } else if (!cruce) {
      // El campeón del playoff del grupo hermano: un rival exigente que no juega en nuestro grupo.
      const t = (await tx.query<{ numero: number; inicio: string }>("select numero, to_char(inicio, 'YYYY-MM-DD') as inicio from temporadas where id = $1", [temporadaId])).rows[0];
      const nivel = (
        await tx.query<{ m: number }>(
          `select avg(j.media)::float8 as m from jugadores j where j.club_id = any($1::uuid[])`,
          [tabla.slice(0, 5)],
        )
      ).rows[0].m;
      const rng = crearRng(semillaAleatoria());
      const hermano = await insertarClubBot(
        tx,
        rng,
        { nivel: nivel * 1.03, grupo: null, temporadaId, temporadaNumero: t.numero, inicio: new Date(`${t.inicio}T12:00:00Z`), divisionNivel: g.division as NivelDivision },
        await nombresUsados(tx),
      );
      fecha.setUTCDate(fecha.getUTCDate() + 2);
      const casa = rng() < 0.5;
      await crearPartido(tx, temporadaId, g.id, "Cruce de ascenso", LIGA.jornadas + 3, fecha, casa ? final.ganador! : hermano, casa ? hermano : final.ganador!);
      pendiente = true;
    }
  }
  if (!pendiente) await tx.query("update temporadas set fase = 'terminada' where id = $1", [temporadaId]);
}

export type Desenlace = "campeon" | "ascenso" | "playoff" | "permanencia" | "descenso";

export interface ResumenTemporada {
  fase: "liga" | "playoff" | "terminada";
  numero: number;
  posicion: number | null;
  puntos: number | null;
  desenlace: Desenlace | null;
  playoff: { id: string; ronda: string; local: string; visitante: string; golesLocal: number | null; golesVisitante: number | null; ganador: string | null }[];
}

/** Cómo va (o cómo ha terminado) la temporada de un club. */
export async function resumenTemporada(clubId: string): Promise<ResumenTemporada | null> {
  const bd = await bdLocal();
  const t = (await bd.query<{ id: number; numero: number; fase: ResumenTemporada["fase"] }>("select id, numero, fase from temporadas where actual")).rows[0];
  if (!t) return null;
  const club = (await bd.query<{ grupo: number | null }>("select grupo_id as grupo from clubes where id = $1", [clubId])).rows[0];
  const tabla = club?.grupo != null ? await bd.transaction((tx) => clasificacionGrupo(tx, t.id, club.grupo!)) : [];
  const pos = tabla.indexOf(clubId);
  const puntos = (await bd.query<{ p: number }>("select puntos as p from clasificacion where temporada_id = $1 and club_id = $2", [t.id, clubId])).rows[0]?.p ?? null;
  const playoff = (
    await bd.query<ResumenTemporada["playoff"][number]>(
      `select p.id, p.ronda, l.nombre as local, v.nombre as visitante, p.goles_local as "golesLocal", p.goles_visitante as "golesVisitante",
              w.nombre as ganador
         from partidos p join clubes l on l.id = p.local_id join clubes v on v.id = p.visitante_id left join clubes w on w.id = p.ganador_id
        where p.temporada_id = $1 and p.grupo_id = $2 and p.competicion = 'playoff' order by p.jornada, p.id`,
      [t.id, club?.grupo ?? -1],
    )
  ).rows;
  return {
    fase: t.fase,
    numero: t.numero,
    posicion: pos >= 0 ? pos + 1 : null,
    puntos,
    desenlace: t.fase === "terminada" ? await desenlaceDe(clubId, t.id) : null,
    playoff,
  };
}

async function desenlaceDe(clubId: string, temporadaId: number): Promise<Desenlace> {
  const bd = await bdLocal();
  const club = (
    await bd.query<{ grupo: number; division: number; bot: boolean }>(
      "select c.grupo_id as grupo, g.division, c.manager_id is null as bot from clubes c join grupos g on g.id = c.grupo_id where c.id = $1",
      [clubId],
    )
  ).rows[0];
  const tabla = await bd.transaction((tx) => clasificacionGrupo(tx, temporadaId, club.grupo));
  const pos = tabla.indexOf(clubId);
  // Los bots no ascienden: su plaza pasa al siguiente humano.
  if (pos === 0) return club.bot ? "permanencia" : "campeon";
  const cruce = (
    await bd.query<{ ganador: string | null }>(
      "select ganador_id as ganador from partidos where temporada_id = $1 and grupo_id = $2 and ronda = 'Cruce de ascenso'",
      [temporadaId, club.grupo],
    )
  ).rows[0];
  if (cruce?.ganador === clubId && !club.bot) return "ascenso";
  if (pos >= 1 && pos <= 4) return "playoff";
  if (club.division < 5 && pos >= tabla.length - LIGA.descensos) return "descenso";
  return "permanencia";
}

/** Escala los atributos de los jugadores de un club para acercar su media al objetivo. */
async function nivelarClub(tx: Transaction, clubId: string, objetivo: number) {
  const jugadores = (await tx.query<{ id: string; atributos: Record<string, number>; edad: number }>(
    `select id, atributos, date_part('year', age((select inicio from temporadas where actual), fecha_nacimiento))::int as edad
       from jugadores where club_id = $1`,
    [clubId],
  )).rows;
  if (jugadores.length === 0) return;
  const actual = jugadores.reduce((a, j) => a + mediaJugador(j.atributos), 0) / jugadores.length;
  const factor = objetivo / Math.max(0.1, actual);
  for (const j of jugadores) {
    const atributos = Object.fromEntries(Object.entries(j.atributos).map(([k, v]) => [k, Math.max(1, Math.min(100, Math.round(v * factor)))]));
    const media = mediaJugador(atributos);
    await tx.query("update jugadores set atributos = $2::jsonb, media = $3, valor_mercado = $4 where id = $1", [j.id, JSON.stringify(atributos), media, valorJugador(media, j.edad)]);
  }
}

export class ErrorTemporada extends Error {}

/**
 * Cierra la temporada y abre la siguiente: historial, ascenso a la nueva división (con rivales a
 * tu altura), contratos que vencen, retiradas, declive de veteranos y calendario nuevo.
 */
export async function nuevaTemporada(clubId: string): Promise<number> {
  const bd = await bdLocal();
  const t = (await bd.query<{ id: number; numero: number; fase: string }>("select id, numero, fase from temporadas where actual")).rows[0];
  if (!t || t.fase !== "terminada") throw new ErrorTemporada("La temporada todavía no ha terminado.");
  const desenlace = await desenlaceDe(clubId, t.id);

  const numero = await bd.transaction(async (tx) => {
    const rng = crearRng(semillaAleatoria());
    const club = (
      await tx.query<{ grupo: number; division: NivelDivision }>(
        "select c.grupo_id as grupo, g.division from clubes c join grupos g on g.id = c.grupo_id where c.id = $1",
        [clubId],
      )
    ).rows[0];

    // Historial de todos los clubes del grupo.
    const tabla = await clasificacionGrupo(tx, t.id, club.grupo);
    for (const [i, id] of tabla.entries()) {
      const puntos = (await tx.query<{ p: number }>("select puntos as p from clasificacion where temporada_id = $1 and club_id = $2", [t.id, id])).rows[0].p;
      const d = id === clubId ? desenlace : i === 0 ? "permanencia" : i <= 4 ? "playoff" : "permanencia";
      await tx.query(
        "insert into historial (temporada_id, club_id, division, grupo, posicion, puntos, desenlace) values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing",
        [t.id, id, club.division, club.grupo, i + 1, puntos, d],
      );
    }

    // Nueva temporada
    const fin = await ultimaFecha(tx, t.id);
    fin.setUTCDate(fin.getUTCDate() + 7);
    const inicio = proximoLunes(fin);
    const cierre = new Date(inicio);
    cierre.setUTCDate(cierre.getUTCDate() + LIGA.semanasTemporada * 7 - 1);
    await tx.query("update temporadas set actual = false where id = $1", [t.id]);
    const nueva = (
      await tx.query<{ id: number }>(
        "insert into temporadas (numero, inicio, fin, actual, fase) values ($1, $2, $3, true, 'liga') returning id",
        [t.numero + 1, isoFecha(inicio), isoFecha(cierre)],
      )
    ).rows[0].id;

    const mediaPropia = (await tx.query<{ m: number }>("select avg(media)::float8 as m from jugadores where club_id = $1", [clubId])).rows[0].m;
    let grupoActivo = club.grupo;
    let divisionActiva = club.division;
    const sube = (desenlace === "campeon" || desenlace === "ascenso") && club.division > 0;
    if (sube) {
      // Ascenso: grupo nuevo en la división superior con bots a tu nivel (como acaba de ascender, exigente pero jugable).
      divisionActiva = (club.division - 1) as NivelDivision;
      const siguienteNumero = (
        await tx.query<{ n: number }>("select coalesce(max(numero), 0)::int + 1 as n from grupos where division = $1", [divisionActiva])
      ).rows[0].n;
      grupoActivo = (await tx.query<{ id: number }>("insert into grupos (division, numero, abierto) values ($1, $2, true) returning id", [divisionActiva, siguienteNumero])).rows[0].id;
      await tx.query("update grupos set abierto = false where id = $1", [club.grupo]);
      await tx.query("update clubes set grupo_id = $2 where id = $1", [clubId, grupoActivo]);
      const usados = await nombresUsados(tx);
      for (let i = 0; i < LIGA.equiposPorGrupo - 1; i++) {
        await insertarClubBot(
          tx,
          rng,
          { grupo: grupoActivo, temporadaId: nueva, temporadaNumero: t.numero + 1, inicio, divisionNivel: divisionActiva, nivel: mediaPropia * uniforme(rng, 1 - BOTS.variacionNivel, 1 + BOTS.variacionNivel) },
          usados,
        );
      }
      const prima = Math.round(division(divisionActiva).presupuesto * PRIMA_ASCENSO);
      await movimiento(tx, clubId, nueva, null, "Prima de ascenso", prima);
      await tx.query("update clubes set masa_social = round(masa_social * 1.35), popularidad = least(100, popularidad + 10) where id = $1", [clubId]);
    } else {
      // Mismo grupo: los bots se ajustan al nivel del grupo (en Quinta, algo por debajo).
      const objetivo = mediaPropia * (divisionActiva === 5 ? BOTS.nivelEnQuinta : 1);
      const bots = (await tx.query<{ id: string }>("select id from clubes where grupo_id = $1 and manager_id is null", [grupoActivo])).rows;
      for (const b of bots) await nivelarClub(tx, b.id, objetivo * uniforme(rng, 1 - BOTS.variacionNivel, 1 + BOTS.variacionNivel));
      const pos = tabla.indexOf(clubId);
      await tx.query("update clubes set masa_social = round(masa_social * $2::numeric) where id = $1", [clubId, 1 + Math.max(0, 10 - pos) / 100]);
    }
    for (const id of (await tx.query<{ id: string }>("select id from clubes where grupo_id = $1", [grupoActivo])).rows.map((r) => r.id)) {
      await tx.query("insert into clasificacion (temporada_id, grupo_id, club_id) values ($1, $2, $3) on conflict do nothing", [nueva, grupoActivo, id]);
    }

    // Jugadores: retiradas, declive de veteranos, contratos y estado físico a cero.
    const jugadores = (
      await tx.query<{ id: string; club: string | null; humano: boolean; nombre: string; apellido: string; atributos: Record<string, number>; edad: number; contrato: number | null }>(
        `select j.id, j.club_id as club, c.manager_id is not null as humano, j.nombre, j.apellido, j.atributos,
                date_part('year', age($1::date, j.fecha_nacimiento))::int as edad, j.contrato_hasta as contrato
           from jugadores j left join clubes c on c.id = j.club_id where not j.retirado`,
        [isoFecha(inicio)],
      )
    ).rows;
    const vencen: string[] = [];
    const retirados: string[] = [];
    for (const j of jugadores) {
      if (j.edad >= 36 || (j.edad >= 34 && rng() < 0.35)) {
        await tx.query("update jugadores set retirado = true, club_id = null, precio_venta = null where id = $1", [j.id]);
        if (j.humano) retirados.push(`${j.nombre} ${j.apellido}`);
        continue;
      }
      let atributos = j.atributos;
      if (j.edad >= 31) {
        atributos = { ...j.atributos };
        for (const a of ["velocidad", "resistencia", "fuerza"]) if (a in atributos) atributos[a] = Math.max(1, atributos[a] - Math.round(uniforme(rng, 1, 3)));
      }
      const media = mediaJugador(atributos);
      let club = j.club;
      let contrato = j.contrato;
      if (club && contrato != null && contrato < t.numero + 1) {
        if (j.humano) {
          club = null; // Se va libre.
          vencen.push(`${j.nombre} ${j.apellido}`);
        } else contrato = t.numero + 1 + Math.floor(rng() * 3);
      }
      await tx.query(
        `update jugadores set atributos = $2::jsonb, media = $3, valor_mercado = $4, club_id = $5, contrato_hasta = $6,
                cansancio = 0, forma = 50, jornadas_lesion = 0, tipo_lesion = null, cambios_semana = '{}',
                precio_venta = case when $5::uuid is null then null else precio_venta end,
                dorsal = case when $5::uuid is null then null else dorsal end
          where id = $1`,
        [j.id, JSON.stringify(atributos), media, valorJugador(media, j.edad), club, contrato],
      );
    }

    // El planteamiento guardado puede tener jugadores que ya no están: se rehace al primer partido.
    await tx.query(
      `update clubes set planteamiento = null where id = $1 and exists (
         select 1 from jsonb_array_elements_text(coalesce(planteamiento->'once', '[]')) x
          where not exists (select 1 from jugadores j where j.id::text = x and j.club_id = $1))`,
      [clubId],
    );

    // Mercado renovado: nuevos agentes libres al nivel de la división.
    await tx.query("delete from jugadores where club_id is null and not retirado and contrato_hasta is null and id not in (select unnest(titulares) from planteamientos)");
    await generarAgentesLibres(tx, rng, mediaPropia, MERCADO_LOCAL.agentesLibres, inicio, t.numero + 1, divisionActiva);

    const textoAscenso = sube ? `¡Ascendemos a ${division(divisionActiva).nombre}! ` : "";
    const detalles = [
      vencen.length > 0 ? `Terminan contrato y se van: ${vencen.join(", ")}.` : "",
      retirados.length > 0 ? `Se retiran: ${retirados.join(", ")}.` : "",
    ].filter(Boolean).join(" ");
    await publicarNoticia(tx, clubId, "temporada", `Arranca la temporada ${t.numero + 1}`,
      `${textoAscenso}${detalles || "La plantilla sigue al completo."} La liga empieza el lunes ${inicio.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}.`, 0);
    return t.numero + 1;
  });
  await asegurarCalendario();
  return numero;
}
