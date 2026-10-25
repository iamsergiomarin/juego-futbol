import type { PGlite, Transaction } from "@electric-sql/pglite";
import { crearRng, semillaAleatoria, simularPartido, uniforme, type EquipoPartido, type JugadorPartido, type Posicion } from "@/motor";
import { calendarioDobleVuelta, fechaJornada } from "@/dominio/calendario";
import { ECONOMIA_JORNADA as E, LIGA, division, type NivelDivision } from "@/dominio/reglas";
import { bdLocal } from "./bd";

type Consulta = PGlite | Transaction;

/** Alineación por defecto: 4-4-2 con los mejores de cada puesto y cinco suplentes. */
const ONCE: Record<Posicion, number> = { POR: 1, DEF: 4, MED: 4, DEL: 2 };
const BANQUILLO: Posicion[] = ["POR", "DEF", "MED", "DEL", "MED"];

/**
 * Crea el calendario de liga de los grupos abiertos que aún no lo tienen.
 * También sirve para partidas creadas antes de que existiera la liga.
 */
export async function asegurarCalendario(): Promise<void> {
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    const temporada = (
      await tx.query<{ id: number; inicio: string }>("select id, to_char(inicio, 'YYYY-MM-DD') as inicio from temporadas where actual")
    ).rows[0];
    if (!temporada) return;
    const grupos = (
      await tx.query<{ id: number }>(
        `select g.id from grupos g where g.abierto and not exists (
           select 1 from partidos p where p.grupo_id = g.id and p.temporada_id = $1 and p.competicion = 'liga')`,
        [temporada.id],
      )
    ).rows;
    for (const g of grupos) {
      const clubes = (await tx.query<{ id: string }>("select id from clubes where grupo_id = $1 order by id", [g.id])).rows.map((r) => r.id);
      if (clubes.length !== LIGA.equiposPorGrupo) continue;
      const rng = crearRng(semillaAleatoria());
      const valores: unknown[] = [];
      const filas = calendarioDobleVuelta(clubes, rng).map((e, i) => {
        const fecha = fechaJornada(temporada.inicio, e.jornada);
        valores.push(temporada.id, g.id, e.jornada, e.local, e.visitante, `${fecha} ${E.horaPartido}`, Math.floor(rng() * 2 ** 31));
        const b = i * 7;
        return `($${b + 1}, 'liga', $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, ($${b + 6}::timestamp at time zone 'Europe/Madrid'), $${b + 7})`;
      });
      await tx.query(
        `insert into partidos (temporada_id, competicion, grupo_id, jornada, local_id, visitante_id, inicio, semilla)
         values ${filas.join(", ")}`,
        valores,
      );
    }
  });
}

interface FilaJugador {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  atributos: Record<string, number>;
  media: number;
}

/** Monta el equipo para el motor a partir de la plantilla del club. */
export async function equipoParaPartido(bd: Consulta, clubId: string): Promise<EquipoPartido> {
  const club = (await bd.query<{ nombre: string }>("select nombre from clubes where id = $1", [clubId])).rows[0];
  const jugadores = (
    await bd.query<FilaJugador>(
      `select id, nombre, apellido, posicion, atributos, media::float8 as media from jugadores
        where club_id = $1 and ficha = 'primer_equipo' and not retirado
          and (lesion_hasta is null or lesion_hasta < current_date) and partidos_sancion = 0
        order by media desc`,
      [clubId],
    )
  ).rows;
  const usados = new Set<string>();
  const aMotor = (j: FilaJugador): JugadorPartido => ({ id: j.id, nombre: `${j.nombre} ${j.apellido}`, posicion: j.posicion, atributos: j.atributos });
  const tomar = (pos: Posicion): FilaJugador | undefined => {
    const j = jugadores.find((x) => x.posicion === pos && !usados.has(x.id)) ?? jugadores.find((x) => !usados.has(x.id) && x.posicion !== "POR");
    if (j) usados.add(j.id);
    return j;
  };
  const titulares: JugadorPartido[] = [];
  for (const [pos, n] of Object.entries(ONCE) as [Posicion, number][]) {
    for (let i = 0; i < n; i++) {
      const j = tomar(pos);
      if (j) titulares.push({ ...aMotor(j), posicion: pos });
    }
  }
  const banquillo = BANQUILLO.map(tomar).filter((j): j is FilaJugador => Boolean(j)).map(aMotor);
  return {
    id: clubId,
    nombre: club.nombre,
    titulares,
    banquillo,
    tactica: { mentalidad: "equilibrada", presion: "normal" },
    familiaridad: 0.8,
    condicionales: [],
    segundoEntrenador: true,
  };
}

async function movimiento(tx: Transaction, club: string, temporada: number, jornada: number, concepto: string, importe: number) {
  if (importe === 0) return;
  await tx.query(
    "insert into movimientos (club_id, temporada_id, jornada, concepto, importe) values ($1, $2, $3, $4, $5)",
    [club, temporada, jornada, concepto, Math.round(importe)],
  );
  await tx.query("update clubes set dinero = dinero + $2 where id = $1", [club, Math.round(importe)]);
}

async function sumarClasificacion(tx: Transaction, temporada: number, grupo: number, club: string, favor: number, contra: number) {
  const [g, e, p, pts] = favor > contra ? [1, 0, 0, 3] : favor === contra ? [0, 1, 0, 1] : [0, 0, 1, 0];
  await tx.query(
    `update clasificacion set jugados = jugados + 1, ganados = ganados + $4, empatados = empatados + $5, perdidos = perdidos + $6,
            goles_favor = goles_favor + $7, goles_contra = goles_contra + $8, puntos = puntos + $9
      where temporada_id = $1 and grupo_id = $2 and club_id = $3`,
    [temporada, grupo, club, g, e, p, favor, contra, pts],
  );
}

export interface ResultadoJornada {
  jornada: number;
  partidos: number;
  terminada: boolean;
}

/** Juega la siguiente jornada pendiente de liga en todos los grupos abiertos. */
export async function jugarSiguienteJornada(): Promise<ResultadoJornada | null> {
  await asegurarCalendario();
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const t = (await tx.query<{ id: number }>("select id from temporadas where actual")).rows[0];
    if (!t) return null;
    const siguiente = (
      await tx.query<{ jornada: number | null }>(
        "select min(jornada)::int as jornada from partidos where temporada_id = $1 and competicion = 'liga' and estado <> 'finalizado'",
        [t.id],
      )
    ).rows[0].jornada;
    if (siguiente == null) return { jornada: LIGA.jornadas, partidos: 0, terminada: true };

    const partidos = (
      await tx.query<{ id: string; grupo: number; division: NivelDivision; local: string; visitante: string; semilla: number }>(
        `select p.id, p.grupo_id as grupo, g.division, p.local_id as local, p.visitante_id as visitante, p.semilla::float8 as semilla
           from partidos p join grupos g on g.id = p.grupo_id
          where p.temporada_id = $1 and p.competicion = 'liga' and p.jornada = $2 and p.estado <> 'finalizado'`,
        [t.id, siguiente],
      )
    ).rows;

    for (const p of partidos) {
      const local = await equipoParaPartido(tx, p.local);
      const visitante = await equipoParaPartido(tx, p.visitante);
      const r = simularPartido(local, visitante, p.semilla);

      // Taquilla y restauración del local
      const club = (
        await tx.query<{ masa: number; aforo: number; puntos: number }>(
          `select c.masa_social as masa, coalesce(sum(s.aforo), 0)::int as aforo, coalesce(sum(s.puntos_venta), 0)::int as puntos
             from clubes c left join sectores_estadio s on s.club_id = c.id where c.id = $1 group by c.id`,
          [p.local],
        )
      ).rows[0];
      const rng = crearRng(p.semilla + 1);
      const demanda = (club.masa * E.demandaPorSocio + E.publicoOcasional) * uniforme(rng, 0.85, 1.15);
      const asistencia = Math.min(club.aforo, Math.round(demanda));
      const atendidos = Math.min(asistencia, club.puntos * E.aforoPorPuntoVenta);

      await tx.query(
        `update partidos set estado = 'finalizado', minuto = 90, goles_local = $2, goles_visitante = $3,
                estadisticas = $4::jsonb, eventos = $5::jsonb, asistencia = $6 where id = $1`,
        [p.id, r.goles[0], r.goles[1], JSON.stringify({ tiros: r.tiros, posesion: r.posesion, xg: r.xg }), JSON.stringify(r.eventos), asistencia],
      );
      for (const eq of [local, visitante]) {
        await tx.query(
          `insert into planteamientos (partido_id, club_id, titulares, banquillo) values ($1, $2, $3::uuid[], $4::uuid[])
           on conflict (partido_id, club_id) do update set titulares = excluded.titulares, banquillo = excluded.banquillo`,
          [p.id, eq.id, eq.titulares.map((j) => j.id), eq.banquillo.map((j) => j.id)],
        );
      }
      await sumarClasificacion(tx, t.id, p.grupo, p.local, r.goles[0], r.goles[1]);
      await sumarClasificacion(tx, t.id, p.grupo, p.visitante, r.goles[1], r.goles[0]);
      await movimiento(tx, p.local, t.id, siguiente, "Taquilla", asistencia * E.precioEntrada[p.division]);
      await movimiento(tx, p.local, t.id, siguiente, "Restauración", atendidos * E.gastoRestauracion);
    }

    // Cierre de semana (jornada del sábado): salarios, televisión y patrocinio
    if (siguiente % 2 === 0) {
      const semanas = LIGA.jornadas / 2;
      const clubes = (
        await tx.query<{ id: string; division: NivelDivision; jugadores: number; personal: number }>(
          `select c.id, g.division,
                  coalesce((select sum(salario) from jugadores j where j.club_id = c.id), 0)::float8 as jugadores,
                  coalesce((select sum(salario) from personal s where s.club_id = c.id), 0)::float8 as personal
             from clubes c join grupos g on g.id = c.grupo_id where g.abierto`,
        )
      ).rows;
      for (const c of clubes) {
        const presupuesto = division(c.division).presupuesto;
        await movimiento(tx, c.id, t.id, siguiente, "Salarios de la plantilla", -c.jugadores / semanas);
        await movimiento(tx, c.id, t.id, siguiente, "Salarios del cuerpo técnico", -c.personal / semanas);
        await movimiento(tx, c.id, t.id, siguiente, "Derechos de televisión", (presupuesto * E.televisionFija) / semanas);
        await movimiento(tx, c.id, t.id, siguiente, "Patrocinio", (presupuesto * E.patrocinioBase) / semanas);
      }
    }
    return { jornada: siguiente, partidos: partidos.length, terminada: siguiente >= LIGA.jornadas };
  });
}

/** Juega varias jornadas seguidas (o hasta el final de la temporada). */
export async function jugarJornadas(cantidad: number): Promise<ResultadoJornada | null> {
  let ultimo: ResultadoJornada | null = null;
  for (let i = 0; i < cantidad; i++) {
    const r = await jugarSiguienteJornada();
    if (!r || r.partidos === 0) return ultimo ?? r;
    ultimo = r;
    if (r.terminada) break;
  }
  return ultimo;
}
