import type { PGlite, Transaction } from "@electric-sql/pglite";
import { crearRng, semillaAleatoria, type Rng } from "@/motor";
import {
  analizarPartido,
  animoTrasEvento,
  animoTrasPartido,
  crearVoces,
  etiquetaAnimo,
  previaPartido,
  reacciones,
  reaccionesEvento,
  reaccionesPartido,
  type Borrador,
  type ContextoPartido,
  type EventoClub,
  type GolPartido,
  type Resultado,
  type TipoAutor,
  type Tono,
  type Voz,
} from "@/dominio/grada";
import { division, GRADA } from "@/dominio/reglas";
import { bdLocal } from "./bd";

type Consulta = PGlite | Transaction;

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------

async function vocesDe(bd: Consulta, clubId: string): Promise<Voz[]> {
  return (await bd.query<Voz>("select id, tipo, nombre, usuario, rasgo from voces_grada where club_id = $1 order by id", [clubId])).rows;
}

async function esHumano(bd: Consulta, clubId: string): Promise<boolean> {
  return (await bd.query<{ h: boolean }>("select manager_id is not null as h from clubes where id = $1", [clubId])).rows[0]?.h ?? false;
}

/** El "ahora" del juego: la fecha del último partido jugado (o el inicio de la temporada). */
async function fechaJuego(bd: Consulta): Promise<string> {
  const { rows } = await bd.query<{ f: string }>(
    `select to_char(coalesce(
        (select max(inicio) from partidos where temporada_id = (select id from temporadas where actual) and estado = 'finalizado'),
        (select inicio::timestamptz from temporadas where actual), now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as f`,
  );
  return rows[0].f;
}

const sumarMinutos = (iso: string, minutos: number) => new Date(Date.parse(iso) + minutos * 60_000).toISOString();

interface Base {
  jornada: number | null;
  partidoId?: string | null;
  /** Fecha del juego de la primera publicación. */
  fecha: string;
}

/** Guarda las publicaciones en orden, con sus reacciones. Las respuestas cuelgan de la publicación indicada. */
async function escribir(tx: Transaction, clubId: string, borradores: Borrador[], base: Base, rng: Rng = crearRng(semillaAleatoria())): Promise<void> {
  if (borradores.length === 0) return;
  const club = (await tx.query<{ masa: number; animo: number }>("select masa_social as masa, animo_grada as animo from clubes where id = $1", [clubId])).rows[0];
  const ids: number[] = [];
  const respuestas = new Map<number, number>();
  for (const [i, b] of borradores.entries()) {
    const r = reacciones(rng, b.alcance, club.masa, club.animo);
    const padre = b.respuestaA !== undefined ? (ids[b.respuestaA] ?? null) : null;
    const fecha = sumarMinutos(base.fecha, i * 6 + Math.floor(rng() * 5));
    const id = (
      await tx.query<{ id: number }>(
        `insert into publicaciones (club_id, temporada_id, jornada, partido_id, autor_tipo, autor_nombre, autor_usuario, texto, tono,
                me_gusta, comentarios, compartidos, respuesta_a, fecha)
         values ($1, (select id from temporadas where actual), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz)
         returning id::float8 as id`,
        [clubId, base.jornada, base.partidoId ?? null, b.autor.tipo, b.autor.nombre, b.autor.usuario, b.texto, b.tono, r.meGusta, r.comentarios, r.compartidos, padre, fecha],
      )
    ).rows[0].id;
    ids.push(id);
    if (padre) respuestas.set(padre, (respuestas.get(padre) ?? 0) + 1);
  }
  for (const [padre, n] of respuestas) await tx.query("update publicaciones set comentarios = comentarios + $2 where id = $1", [padre, n]);
}

async function moverAnimo(tx: Transaction, clubId: string, nuevo: (actual: number) => number) {
  const actual = (await tx.query<{ a: number }>("select animo_grada as a from clubes where id = $1", [clubId])).rows[0].a;
  await tx.query("update clubes set animo_grada = $2 where id = $1", [clubId, nuevo(actual)]);
}

/**
 * Crea la grada de los clubes con mánager que aún no la tienen (partidas nuevas y partidas
 * anteriores a La Grada) y publica la bienvenida.
 */
export async function asegurarGrada(): Promise<void> {
  const bd = await bdLocal();
  const sinGrada = (
    await bd.query<{ id: string }>(
      `select c.id from clubes c where c.manager_id is not null and not exists (select 1 from voces_grada v where v.club_id = c.id)`,
    )
  ).rows;
  if (sinGrada.length === 0) return;
  await bd.transaction(async (tx) => {
    const rng = crearRng(semillaAleatoria());
    for (const { id } of sinGrada) {
      const c = (
        await tx.query<{ nombre: string; corto: string; ciudad: string; manager: string; division: number | null }>(
          `select c.nombre, coalesce(c.nombre_corto, c.nombre) as corto, coalesce(c.ciudad, '') as ciudad, m.nombre as manager, g.division::int as division
             from clubes c join managers m on m.id = c.manager_id left join grupos g on g.id = c.grupo_id where c.id = $1`,
          [id],
        )
      ).rows[0];
      for (const v of crearVoces(rng, { nombre: c.nombre, corto: c.corto, ciudad: c.ciudad })) {
        await tx.query("insert into voces_grada (club_id, tipo, nombre, usuario, rasgo) values ($1, $2, $3, $4, $5) on conflict do nothing", [id, v.tipo, v.nombre, v.usuario, v.rasgo]);
      }
      await publicarEvento(tx, id, { tipo: "bienvenida", manager: c.manager, ciudad: c.ciudad, division: division((c.division ?? 5) as 0 | 1 | 2 | 3 | 4 | 5).nombre });
    }
  });
}

// -----------------------------------------------------------------------------
// Acontecimientos del club
// -----------------------------------------------------------------------------

type SinContexto<T> = T extends unknown ? Omit<T, "club" | "mediaEquipo"> : never;

/** Reacción de la grada a un fichaje, una venta, una renovación o un hito de la temporada. */
export async function publicarEvento(tx: Transaction, clubId: string, ev: SinContexto<EventoClub>): Promise<void> {
  if (!(await esHumano(tx, clubId))) return;
  const voces = await vocesDe(tx, clubId);
  if (voces.length === 0) return;
  const c = (
    await tx.query<{ nombre: string; media: number | null }>(
      "select c.nombre, (select avg(media)::float8 from jugadores j where j.club_id = c.id and not j.retirado) as media from clubes c where c.id = $1",
      [clubId],
    )
  ).rows[0];
  const completo = { ...ev, club: c.nombre, mediaEquipo: c.media ?? 3 } as EventoClub;
  const { borradores, animo } = reaccionesEvento(completo, voces, crearRng(semillaAleatoria()));
  const fecha = sumarMinutos(await fechaJuego(tx), 15 * 60);
  const jornada = (await tx.query<{ j: number }>("select count(distinct jornada)::int as j from partidos where temporada_id = (select id from temporadas where actual) and estado = 'finalizado'")).rows[0].j;
  await escribir(tx, clubId, borradores, { jornada: jornada || null, fecha });
  if (animo !== 0) await moverAnimo(tx, clubId, (a) => animoTrasEvento(a, animo));
}

// -----------------------------------------------------------------------------
// Partidos
// -----------------------------------------------------------------------------

export interface PartidoJugado {
  id: string;
  competicion: "liga" | "playoff";
  ronda: string | null;
  grupo: number | null;
  local: string;
  visitante: string;
}

export interface LesionPartido {
  clubId: string;
  nombre: string;
  tipo: string;
  jornadas: number;
}

interface FilaPartido {
  goles_local: number;
  goles_visitante: number;
  eventos: { minuto: number; tipo: string; lado?: "local" | "visitante"; jugadorId?: string }[];
  asistencia: number | null;
  ganador: string | null;
  inicio: string;
}

async function contextoPartido(tx: Transaction, clubId: string, p: PartidoJugado, jornada: number, lesiones: LesionPartido[]): Promise<ContextoPartido> {
  const local = p.local === clubId;
  const rivalId = local ? p.visitante : p.local;
  const nombres = async (id: string) =>
    (await tx.query<{ nombre: string; corto: string }>("select nombre, coalesce(nombre_corto, nombre) as corto from clubes where id = $1", [id])).rows[0];
  const [club, rival] = [await nombres(clubId), await nombres(rivalId)];
  const f = (
    await tx.query<FilaPartido>(
      `select goles_local, goles_visitante, eventos, asistencia, ganador_id as ganador, inicio::text as inicio from partidos where id = $1`,
      [p.id],
    )
  ).rows[0];
  const lado = local ? "local" : "visitante";
  const ids = [...new Set(f.eventos.filter((e) => e.tipo === "gol" && e.jugadorId).map((e) => e.jugadorId!))];
  const nombresJugador = new Map<string, string>();
  if (ids.length > 0) {
    for (const j of (await tx.query<{ id: string; n: string }>("select id, nombre || ' ' || apellido as n from jugadores where id = any($1::uuid[])", [ids])).rows) nombresJugador.set(j.id, j.n);
  }
  const goles: GolPartido[] = f.eventos
    .filter((e) => e.tipo === "gol")
    .map((e) => ({ minuto: e.minuto, propio: e.lado === lado, jugador: e.jugadorId ? nombresJugador.get(e.jugadorId) : undefined }));

  const tabla =
    p.grupo != null
      ? (
          await tx.query<{ club: string; puntos: number; jugados: number }>(
            `select k.club_id as club, k.puntos::int as puntos, k.jugados::int as jugados from clasificacion k join clubes c on c.id = k.club_id
              where k.temporada_id = (select id from temporadas where actual) and k.grupo_id = $1
              order by k.puntos desc, (k.goles_favor - k.goles_contra) desc, k.goles_favor desc, c.nombre`,
            [p.grupo],
          )
        ).rows
      : [];
  const indice = tabla.findIndex((x) => x.club === clubId);
  const racha = (
    await tx.query<{ r: Resultado }>(
      `select case when goles_local = goles_visitante then 'E'
                   when (local_id = $1 and goles_local > goles_visitante) or (visitante_id = $1 and goles_visitante > goles_local) then 'G' else 'P' end as r
         from partidos where temporada_id = (select id from temporadas where actual) and estado = 'finalizado' and competicion = 'liga'
          and (local_id = $1 or visitante_id = $1) order by inicio desc limit 8`,
      [clubId],
    )
  ).rows.map((x) => x.r);
  const aforo = (await tx.query<{ a: number }>("select coalesce(sum(aforo), 0)::int as a from sectores_estadio where club_id = $1", [clubId])).rows[0].a;
  const golesPropios = local ? f.goles_local : f.goles_visitante;
  const golesRivales = local ? f.goles_visitante : f.goles_local;
  return {
    club: club.nombre,
    rival: rival.nombre,
    rivalCorto: rival.corto,
    local,
    jornada,
    competicion: p.competicion,
    ronda: p.ronda,
    golesPropios,
    golesRivales,
    goles,
    posicion: indice >= 0 ? indice + 1 : null,
    puntos: indice >= 0 ? tabla[indice].puntos : 0,
    equipos: tabla.length,
    racha,
    lesionados: lesiones.filter((l) => l.clubId === clubId).map((l) => ({ nombre: l.nombre, tipo: l.tipo, jornadas: l.jornadas })),
    asistencia: f.asistencia ?? 0,
    aforo,
    eliminatoria: p.competicion === "playoff" ? { pasa: f.ganador === clubId, penaltis: f.goles_local === f.goles_visitante } : undefined,
  };
}

/** Tras una jornada: la grada reacciona al partido de cada club con mánager y el ánimo se actualiza. */
export async function publicarJornada(tx: Transaction, jornada: number, partidos: PartidoJugado[], lesiones: LesionPartido[]): Promise<void> {
  for (const p of partidos) {
    for (const clubId of [p.local, p.visitante]) {
      if (!(await esHumano(tx, clubId))) continue;
      const voces = await vocesDe(tx, clubId);
      if (voces.length === 0) continue;
      const ctx = await contextoPartido(tx, clubId, p, jornada, lesiones);
      const analisis = analizarPartido(ctx);
      const inicio = (await tx.query<{ f: string }>(`select to_char(inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as f from partidos where id = $1`, [p.id])).rows[0].f;
      await escribir(tx, clubId, reaccionesPartido(ctx, voces, crearRng(semillaAleatoria())), { jornada, partidoId: p.id, fecha: sumarMinutos(inicio, 110) });
      await moverAnimo(tx, clubId, (a) => animoTrasPartido(a, analisis.clase, ctx.local));
    }
  }
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Antes del siguiente partido: previa de la prensa, anuncio del club y ambiente en la grada. */
export async function publicarPrevias(tx: Transaction): Promise<void> {
  const clubes = (await tx.query<{ id: string }>("select id from clubes where manager_id is not null")).rows;
  for (const { id: clubId } of clubes) {
    const voces = await vocesDe(tx, clubId);
    if (voces.length === 0) continue;
    const p = (
      await tx.query<{ id: string; local: string; visitante: string; competicion: "liga" | "playoff"; ronda: string | null; jornada: number; grupo: number | null; inicio: string }>(
        `select id, local_id as local, visitante_id as visitante, competicion, ronda, jornada::int as jornada, grupo_id as grupo,
                to_char(inicio at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI') as inicio
           from partidos where temporada_id = (select id from temporadas where actual) and estado <> 'finalizado'
            and competicion in ('liga', 'playoff') and (local_id = $1 or visitante_id = $1) order by inicio limit 1`,
        [clubId],
      )
    ).rows[0];
    if (!p) continue;
    const local = p.local === clubId;
    const nombres = async (id: string) =>
      (await tx.query<{ nombre: string; corto: string }>("select nombre, coalesce(nombre_corto, nombre) as corto from clubes where id = $1", [id])).rows[0];
    const club = await nombres(clubId);
    const rival = await nombres(local ? p.visitante : p.local);
    const fila = (
      await tx.query<{ posicion: number; puntos: number; jugados: number }>(
        `select (select count(*) + 1 from clasificacion o where o.temporada_id = k.temporada_id and o.grupo_id = k.grupo_id
                   and (o.puntos, o.goles_favor - o.goles_contra, o.goles_favor) > (k.puntos, k.goles_favor - k.goles_contra, k.goles_favor))::int as posicion,
                k.puntos::int as puntos, k.jugados::int as jugados
           from clasificacion k where k.temporada_id = (select id from temporadas where actual) and k.club_id = $1`,
        [clubId],
      )
    ).rows[0];
    const fecha = new Date(`${p.inicio}:00Z`);
    const cuando = `el ${DIAS[fecha.getUTCDay()]} a las ${p.inicio.slice(11, 16)}`;
    const borradores = previaPartido(
      {
        club: club.nombre,
        rival: rival.nombre,
        rivalCorto: rival.corto,
        local,
        jornada: p.jornada,
        competicion: p.competicion,
        ronda: p.ronda,
        cuando,
        posicion: fila?.posicion ?? null,
        puntos: fila?.puntos ?? 0,
        jugados: fila?.jugados ?? 0,
      },
      voces,
      crearRng(semillaAleatoria()),
    );
    await escribir(tx, clubId, borradores, { jornada: p.jornada, partidoId: p.id, fecha: sumarMinutos(await fechaJuego(tx), 13 * 60) });
  }
}

// -----------------------------------------------------------------------------
// Lectura para la pantalla
// -----------------------------------------------------------------------------

export type FiltroGrada = "todo" | "aficion" | "prensa" | "club";

export interface PublicacionVista {
  id: number;
  autorTipo: TipoAutor;
  autorNombre: string;
  autorUsuario: string;
  texto: string;
  tono: Tono;
  meGusta: number;
  comentarios: number;
  compartidos: number;
  jornada: number | null;
  /** Milisegundos desde 1970 de la fecha dentro del juego. */
  fecha: number;
  respuestas: PublicacionVista[];
}

const COLUMNAS = `id::float8 as id, autor_tipo as "autorTipo", autor_nombre as "autorNombre", autor_usuario as "autorUsuario", texto, tono,
  me_gusta as "meGusta", comentarios, compartidos, jornada, (extract(epoch from fecha) * 1000)::float8 as fecha, respuesta_a::float8 as "respuestaA"`;

type Fila = Omit<PublicacionVista, "respuestas"> & { respuestaA: number | null };

export async function lineaDeTiempo(bd: Consulta, clubId: string, filtro: FiltroGrada = "todo", limite: number = GRADA.publicacionesPorPagina): Promise<PublicacionVista[]> {
  const tipos = filtro === "aficion" ? ["aficion", "pena", "rival"] : filtro === "prensa" ? ["prensa"] : filtro === "club" ? ["club"] : null;
  const raiz = (
    await bd.query<Fila>(
      `select ${COLUMNAS} from publicaciones where club_id = $1 and respuesta_a is null and ($2::text[] is null or autor_tipo = any($2::text[]))
        order by id desc limit $3`,
      [clubId, tipos, limite],
    )
  ).rows;
  const vista = (f: Fila): PublicacionVista => ({ ...f, respuestas: [] });
  const arbol = raiz.map(vista);
  let nivel = arbol;
  for (let i = 0; i < 3 && nivel.length > 0; i++) {
    const hijos = (
      await bd.query<Fila>(`select ${COLUMNAS} from publicaciones where respuesta_a = any($1::bigint[]) order by id`, [nivel.map((x) => x.id)])
    ).rows;
    const porId = new Map(nivel.map((x) => [x.id, x]));
    nivel = [];
    for (const h of hijos) {
      const padre = porId.get(h.respuestaA!);
      if (!padre) continue;
      const v = vista(h);
      padre.respuestas.push(v);
      nivel.push(v);
    }
  }
  return arbol;
}

export interface EstadoGrada {
  animo: number;
  etiqueta: string;
  tono: Tono;
  seguidores: number;
  voces: Voz[];
  masComentadas: PublicacionVista[];
  etiquetas: string[];
}

/** Ambiente de la grada, cuentas que la forman y lo más visto de la última semana. */
export async function estadoGrada(bd: Consulta, clubId: string): Promise<EstadoGrada> {
  const club = (await bd.query<{ animo: number; masa: number; corto: string }>("select animo_grada as animo, masa_social as masa, coalesce(nombre_corto, nombre) as corto from clubes where id = $1", [clubId])).rows[0];
  const et = etiquetaAnimo(club.animo);
  const voces = await vocesDe(bd, clubId);
  const top = (
    await bd.query<Fila>(
      `select ${COLUMNAS} from (select * from publicaciones where club_id = $1 and respuesta_a is null order by id desc limit 24) r order by me_gusta desc limit 3`,
      [clubId],
    )
  ).rows.map((f) => ({ ...f, respuestas: [] }));
  const ultimo = (
    await bd.query<{ jornada: number | null; rival: string | null }>(
      `select p.jornada::int as jornada, c.nombre_corto as rival from publicaciones p
         left join partidos pa on pa.id = p.partido_id
         left join clubes c on c.id = case when pa.local_id = $1 then pa.visitante_id else pa.local_id end
        where p.club_id = $1 and p.partido_id is not null order by p.id desc limit 1`,
      [clubId],
    )
  ).rows[0];
  const sigla = club.corto.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, "");
  const etiquetas = [`#${sigla}`];
  if (ultimo?.jornada) etiquetas.push(`#Jornada${ultimo.jornada}`);
  if (ultimo?.rival) etiquetas.push(`#${sigla}vs${ultimo.rival.replace(/[^A-Za-z0-9]/g, "")}`);
  return {
    animo: club.animo,
    etiqueta: et.texto,
    tono: et.tono,
    seguidores: Math.max(40, Math.round(club.masa * GRADA.seguidoresPorSocio * 6)),
    voces,
    masComentadas: top,
    etiquetas,
  };
}
