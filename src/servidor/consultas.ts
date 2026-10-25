import { bdLocal, modoLocal } from "./bd";

export interface ManagerLocal {
  id: string;
  nombre: string;
  nivel: number;
  clubId: string;
}

/** En modo local hay un único mánager: el dueño del ordenador. */
export async function managerLocal(): Promise<ManagerLocal | null> {
  if (!modoLocal()) return null;
  const bd = await bdLocal();
  const { rows } = await bd.query<ManagerLocal>(
    `select m.id, m.nombre, m.nivel, c.id as "clubId"
       from managers m join clubes c on c.manager_id = m.id
      order by c.orden_en_grupo_empresarial limit 1`,
  );
  return rows[0] ?? null;
}

export interface JugadorFicha {
  id: string;
  dorsal: number | null;
  nombre: string;
  apellido: string;
  posicion: "POR" | "DEF" | "MED" | "DEL";
  edad: number;
  media: number;
  valor: number;
  salario: number;
  contratoHasta: number | null;
  personalidad: string;
}

export interface FichaClub {
  id: string;
  nombre: string;
  corto: string;
  ciudad: string;
  colorPrincipal: string;
  colorSecundario: string;
  dinero: number;
  masaSocial: number;
  popularidad: number;
  manager: string;
  division: string;
  grupo: number;
  temporada: { numero: number; inicio: string; fin: string };
  aforo: number;
  plantilla: JugadorFicha[];
  personal: { nombre: string; puesto: string; calidad: number; salario: number }[];
  edificios: { tipo: string; nivel: number; areas: { tipo: string; nivel: number }[] }[];
  rivales: { nombre: string; colorPrincipal: string; colorSecundario: string; media: number }[];
}

export async function fichaClub(clubId: string): Promise<FichaClub | null> {
  const bd = await bdLocal();
  const club = (
    await bd.query<Omit<FichaClub, "plantilla" | "personal" | "edificios" | "rivales" | "temporada" | "aforo"> & {
      grupoId: number; tnumero: number; tinicio: string; tfin: string;
    }>(
      `select c.id, c.nombre, c.nombre_corto as corto, c.ciudad, c.color_principal as "colorPrincipal",
              c.color_secundario as "colorSecundario", c.dinero::float8 as dinero, c.masa_social as "masaSocial",
              c.popularidad, m.nombre as manager, d.nombre as division, g.numero as grupo, g.id as "grupoId",
              t.numero as tnumero, to_char(t.inicio, 'YYYY-MM-DD') as tinicio, to_char(t.fin, 'YYYY-MM-DD') as tfin
         from clubes c
         join grupos g on g.id = c.grupo_id
         join divisiones d on d.nivel = g.division
         left join managers m on m.id = c.manager_id
         cross join lateral (select * from temporadas where actual) t
        where c.id = $1`,
      [clubId],
    )
  ).rows[0];
  if (!club) return null;

  const plantilla = (
    await bd.query<JugadorFicha>(
      `select j.id, j.dorsal, j.nombre, j.apellido, j.posicion,
              date_part('year', age((select inicio from temporadas where actual), j.fecha_nacimiento))::int as edad,
              j.media::float8 as media, j.valor_mercado::float8 as valor, j.salario::float8 as salario,
              j.contrato_hasta as "contratoHasta", j.personalidad
         from jugadores j where j.club_id = $1 and j.ficha = 'primer_equipo'
        order by array_position(array['POR','DEF','MED','DEL']::posicion[], j.posicion), j.media desc`,
      [clubId],
    )
  ).rows;

  const personal = (
    await bd.query<FichaClub["personal"][number]>(
      `select nombre, puesto, calidad, salario::float8 as salario from personal where club_id = $1
        order by array_position(array['segundo_entrenador','preparador_fisico','ojeador']::puesto_personal[], puesto)`,
      [clubId],
    )
  ).rows;

  const edificios = (
    await bd.query<FichaClub["edificios"][number]>(
      `select e.tipo, e.nivel,
              coalesce(json_agg(json_build_object('tipo', a.tipo, 'nivel', a.nivel) order by a.tipo)
                       filter (where a.id is not null), '[]') as areas
         from edificios e left join areas a on a.edificio_id = e.id
        where e.club_id = $1 group by e.id
        order by array_position(array['estadio','sede','ciudad_deportiva','centro_medico','escuela_cantera']::tipo_edificio[], e.tipo)`,
      [clubId],
    )
  ).rows;

  const aforo = (
    await bd.query<{ aforo: number }>("select coalesce(sum(aforo), 0)::int as aforo from sectores_estadio where club_id = $1", [clubId])
  ).rows[0].aforo;

  const rivales = (
    await bd.query<FichaClub["rivales"][number]>(
      `select c.nombre, c.color_principal as "colorPrincipal", c.color_secundario as "colorSecundario",
              round(avg(j.media), 1)::float8 as media
         from clubes c join jugadores j on j.club_id = c.id
        where c.grupo_id = $1 and c.id <> $2
        group by c.id order by c.nombre`,
      [club.grupoId, clubId],
    )
  ).rows;

  return {
    id: club.id,
    nombre: club.nombre,
    corto: club.corto,
    ciudad: club.ciudad,
    colorPrincipal: club.colorPrincipal,
    colorSecundario: club.colorSecundario,
    dinero: club.dinero,
    masaSocial: club.masaSocial,
    popularidad: club.popularidad,
    manager: club.manager,
    division: club.division,
    grupo: club.grupo,
    temporada: { numero: club.tnumero, inicio: club.tinicio, fin: club.tfin },
    aforo,
    plantilla,
    personal,
    edificios,
    rivales,
  };
}

// ---------------------------------------------------------------------------
// Liga
// ---------------------------------------------------------------------------

export interface ClubBreve {
  id: string;
  nombre: string;
  corto: string;
  colorPrincipal: string;
  colorSecundario: string;
}

export interface CabeceraClub extends ClubBreve {
  division: string;
  grupo: number;
  grupoId: number;
  manager: string;
}

export async function cabeceraClub(clubId: string): Promise<CabeceraClub | null> {
  const bd = await bdLocal();
  const { rows } = await bd.query<CabeceraClub>(
    `select c.id, c.nombre, c.nombre_corto as corto, c.color_principal as "colorPrincipal", c.color_secundario as "colorSecundario",
            d.nombre as division, g.numero as grupo, g.id as "grupoId", coalesce(m.nombre, '') as manager
       from clubes c join grupos g on g.id = c.grupo_id join divisiones d on d.nivel = g.division
       left join managers m on m.id = c.manager_id where c.id = $1`,
    [clubId],
  );
  return rows[0] ?? null;
}

export interface EstadoTemporada {
  id: number;
  numero: number;
  jugadas: number;
  total: number;
  proximaFecha: string | null;
}

export async function estadoTemporada(): Promise<EstadoTemporada | null> {
  const bd = await bdLocal();
  const { rows } = await bd.query<EstadoTemporada>(
    `select t.id, t.numero,
            coalesce((select max(jornada) from partidos p where p.temporada_id = t.id and p.competicion = 'liga'
                        and not exists (select 1 from partidos q where q.temporada_id = t.id and q.competicion = 'liga'
                                          and q.jornada = p.jornada and q.estado <> 'finalizado')), 0)::int as jugadas,
            coalesce((select max(jornada) from partidos p where p.temporada_id = t.id and p.competicion = 'liga'), 0)::int as total,
            (select to_json(min(inicio))#>>'{}' from partidos p where p.temporada_id = t.id and p.estado <> 'finalizado') as "proximaFecha"
       from temporadas t where t.actual`,
  );
  return rows[0] ?? null;
}

export interface FilaClasificacion extends ClubBreve {
  posicion: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  puntos: number;
  bot: boolean;
  racha: ("G" | "E" | "P")[];
}

export async function clasificacion(grupoId: number): Promise<FilaClasificacion[]> {
  const bd = await bdLocal();
  const { rows } = await bd.query<Omit<FilaClasificacion, "posicion">>(
    `select c.id, c.nombre, c.nombre_corto as corto, c.color_principal as "colorPrincipal", c.color_secundario as "colorSecundario",
            k.jugados, k.ganados, k.empatados, k.perdidos, k.goles_favor as "golesFavor", k.goles_contra as "golesContra",
            k.puntos, c.manager_id is null as bot,
            coalesce((select array_agg(r order by inicio desc) from (
               select p.inicio, case when (case when p.local_id = c.id then p.goles_local - p.goles_visitante
                                                else p.goles_visitante - p.goles_local end) > 0 then 'G'
                                     when p.goles_local = p.goles_visitante then 'E' else 'P' end as r
                 from partidos p where p.estado = 'finalizado' and p.competicion = 'liga' and p.temporada_id = k.temporada_id
                  and (p.local_id = c.id or p.visitante_id = c.id)
                order by p.inicio desc limit 5) u), '{}') as racha
       from clasificacion k join clubes c on c.id = k.club_id
      where k.grupo_id = $1 and k.temporada_id = (select id from temporadas where actual)
      order by k.puntos desc, (k.goles_favor - k.goles_contra) desc, k.goles_favor desc, c.nombre`,
    [grupoId],
  );
  return rows.map((r, i) => ({ ...r, posicion: i + 1 }));
}

export interface PartidoBreve {
  id: string;
  jornada: number;
  competicion: "liga" | "playoff" | "copa" | "amistoso" | "filial" | "continental";
  ronda: string | null;
  inicio: string;
  estado: "programado" | "en_juego" | "finalizado";
  local: ClubBreve;
  visitante: ClubBreve;
  golesLocal: number | null;
  golesVisitante: number | null;
}

const SELECT_PARTIDO = `
  select p.id, p.jornada, p.competicion, p.ronda, to_json(p.inicio)#>>'{}' as inicio, p.estado, p.goles_local as "golesLocal", p.goles_visitante as "golesVisitante",
         json_build_object('id', l.id, 'nombre', l.nombre, 'corto', l.nombre_corto, 'colorPrincipal', l.color_principal, 'colorSecundario', l.color_secundario) as local,
         json_build_object('id', v.id, 'nombre', v.nombre, 'corto', v.nombre_corto, 'colorPrincipal', v.color_principal, 'colorSecundario', v.color_secundario) as visitante
    from partidos p join clubes l on l.id = p.local_id join clubes v on v.id = p.visitante_id`;

export async function partidosClub(clubId: string, cuales: "jugados" | "pendientes", limite: number): Promise<PartidoBreve[]> {
  const bd = await bdLocal();
  const jugados = cuales === "jugados";
  const { rows } = await bd.query<PartidoBreve>(
    `${SELECT_PARTIDO}
      where (p.local_id = $1 or p.visitante_id = $1) and p.temporada_id = (select id from temporadas where actual)
        and ${jugados ? "p.estado = 'finalizado'" : "p.estado <> 'finalizado'"}
      order by p.inicio ${jugados ? "desc" : "asc"} limit $2`,
    [clubId, limite],
  );
  return rows;
}

export async function partidosJornada(grupoId: number, jornada: number): Promise<PartidoBreve[]> {
  const bd = await bdLocal();
  const { rows } = await bd.query<PartidoBreve>(
    `${SELECT_PARTIDO}
      where p.grupo_id = $1 and p.jornada = $2 and p.competicion = 'liga' and p.temporada_id = (select id from temporadas where actual)
      order by l.nombre`,
    [grupoId, jornada],
  );
  return rows;
}

export interface DetallePartido extends PartidoBreve {
  asistencia: number | null;
  estadisticas: { tiros: [number, number]; posesion: [number, number]; xg: [number, number] } | null;
  eventos: { minuto: number; tipo: string; lado?: "local" | "visitante"; texto: string; jugadorId?: string }[];
  alineaciones: { local: { titulares: string[]; banquillo: string[] }; visitante: { titulares: string[]; banquillo: string[] } };
}

export async function detallePartido(id: string): Promise<DetallePartido | null> {
  const bd = await bdLocal();
  const p = (
    await bd.query<Omit<DetallePartido, "alineaciones">>(
      `${SELECT_PARTIDO.replace("select p.id,", "select p.asistencia, p.estadisticas, p.eventos, p.id,")} where p.id = $1`,
      [id],
    )
  ).rows[0];
  if (!p) return null;
  const nombres = async (clubId: string) => {
    const r = (
      await bd.query<{ titulares: string[]; banquillo: string[] }>(
        `select coalesce((select array_agg(j.nombre || ' ' || j.apellido order by array_position(pl.titulares, j.id))
                            from jugadores j where j.id = any(pl.titulares)), '{}') as titulares,
                coalesce((select array_agg(j.nombre || ' ' || j.apellido order by array_position(pl.banquillo, j.id))
                            from jugadores j where j.id = any(pl.banquillo)), '{}') as banquillo
           from planteamientos pl where pl.partido_id = $1 and pl.club_id = $2`,
        [id, clubId],
      )
    ).rows[0];
    return r ?? { titulares: [], banquillo: [] };
  };
  return { ...p, alineaciones: { local: await nombres(p.local.id), visitante: await nombres(p.visitante.id) } };
}

export interface ResumenEconomia {
  caja: number;
  ingresos: number;
  gastos: number;
  porConcepto: { concepto: string; importe: number }[];
  ultimaJornada: { jornada: number; neto: number } | null;
  masaSalarial: number;
}

export async function resumenEconomia(clubId: string): Promise<ResumenEconomia> {
  const bd = await bdLocal();
  const caja = (await bd.query<{ dinero: number }>("select dinero::float8 as dinero from clubes where id = $1", [clubId])).rows[0].dinero;
  const conceptos = (
    await bd.query<{ concepto: string; importe: number }>(
      `select concepto, sum(importe)::float8 as importe from movimientos
        where club_id = $1 and temporada_id = (select id from temporadas where actual)
        group by concepto order by abs(sum(importe)) desc`,
      [clubId],
    )
  ).rows;
  const ultima = (
    await bd.query<{ jornada: number; neto: number }>(
      `select jornada, sum(importe)::float8 as neto from movimientos
        where club_id = $1 and temporada_id = (select id from temporadas where actual) and jornada is not null
        group by jornada order by jornada desc limit 1`,
      [clubId],
    )
  ).rows[0];
  const masa = (
    await bd.query<{ masa: number }>(
      `select (coalesce((select sum(salario) from jugadores where club_id = $1), 0)
             + coalesce((select sum(salario) from personal where club_id = $1), 0))::float8 as masa`,
      [clubId],
    )
  ).rows[0].masa;
  return {
    caja,
    ingresos: conceptos.filter((c) => c.importe > 0).reduce((a, c) => a + c.importe, 0),
    gastos: conceptos.filter((c) => c.importe < 0).reduce((a, c) => a + c.importe, 0),
    porConcepto: conceptos,
    ultimaJornada: ultima ?? null,
    masaSalarial: masa,
  };
}

export interface EstadisticasJugador {
  jugadorId: string;
  partidos: number;
  goles: number;
}

/** Partidos como titular y goles en liga de los jugadores de un club, en la temporada actual. */
export async function estadisticasPlantilla(clubId: string): Promise<Map<string, EstadisticasJugador>> {
  const bd = await bdLocal();
  const { rows } = await bd.query<EstadisticasJugador>(
    `with t as (select id from temporadas where actual),
          pj as (select unnest(pl.titulares) as jugador from planteamientos pl join partidos p on p.id = pl.partido_id
                  where pl.club_id = $1 and p.temporada_id = (select id from t) and p.estado = 'finalizado' and p.competicion = 'liga'),
          gl as (select e->>'jugadorId' as jugador from partidos p, jsonb_array_elements(p.eventos) e
                  where (p.local_id = $1 or p.visitante_id = $1) and p.temporada_id = (select id from t)
                    and p.competicion = 'liga' and e->>'tipo' = 'gol')
     select j.id as "jugadorId",
            (select count(*) from pj where pj.jugador = j.id)::int as partidos,
            (select count(*) from gl where gl.jugador = j.id::text)::int as goles
       from jugadores j where j.club_id = $1`,
    [clubId],
  );
  return new Map(rows.map((r) => [r.jugadorId, r]));
}

export interface SectorEstadio {
  sector: string;
  nivel: number;
  aforo: number;
  puntosVenta: number;
}

export async function sectoresEstadio(clubId: string): Promise<SectorEstadio[]> {
  const bd = await bdLocal();
  const { rows } = await bd.query<SectorEstadio>(
    `select sector, nivel, aforo, puntos_venta as "puntosVenta" from sectores_estadio where club_id = $1
      order by array_position(array['tribuna','lateral','fondo_norte','fondo_sur','esquinas','cesped'], sector)`,
    [clubId],
  );
  return rows;
}

export interface MovimientoJornada {
  jornada: number | null;
  ingresos: number;
  gastos: number;
  detalle: { concepto: string; importe: number }[];
}

/** Movimientos de la temporada agrupados por jornada (los de fuera de jornada, aparte). */
export async function movimientosPorJornada(clubId: string): Promise<MovimientoJornada[]> {
  const bd = await bdLocal();
  const { rows } = await bd.query<MovimientoJornada>(
    `select jornada,
            coalesce(sum(importe) filter (where importe > 0), 0)::float8 as ingresos,
            coalesce(sum(importe) filter (where importe < 0), 0)::float8 as gastos,
            json_agg(json_build_object('concepto', concepto, 'importe', importe) order by importe desc) as detalle
       from movimientos where club_id = $1 and temporada_id = (select id from temporadas where actual)
      group by jornada order by jornada desc nulls first`,
    [clubId],
  );
  return rows;
}

export interface FilaHistorial {
  temporada: number;
  division: string;
  grupo: number;
  posicion: number;
  puntos: number;
  desenlace: string;
}

export async function historialClub(clubId: string): Promise<FilaHistorial[]> {
  const bd = await bdLocal();
  const { rows } = await bd.query<FilaHistorial>(
    `select t.numero as temporada, d.nombre as division, h.grupo, h.posicion, h.puntos, h.desenlace
       from historial h join temporadas t on t.id = h.temporada_id join divisiones d on d.nivel = h.division
      where h.club_id = $1 order by t.numero desc`,
    [clubId],
  );
  return rows;
}

/** Jornadas (de liga o playoff) que quedan por jugar en la temporada. */
export async function jornadasPendientes(): Promise<number> {
  const bd = await bdLocal();
  const { rows } = await bd.query<{ n: number }>(
    `select count(distinct jornada)::int as n from partidos
      where temporada_id = (select id from temporadas where actual) and competicion in ('liga', 'playoff') and estado <> 'finalizado'`,
  );
  return rows[0].n;
}
