import type { Transaction } from "@electric-sql/pglite";
import { crearRng, mediaJugador, semillaAleatoria, simularPartido, uniforme, type EquipoPartido, type Rng } from "@/motor";
import { calendarioDobleVuelta, fechaJornada } from "@/dominio/calendario";
import {
  aplicarSesion,
  despuesDeJornada,
  ESTADO_FISICO,
  recuperar,
  sortearLesion,
  variacionForma,
  NOMBRE_ENFOQUE,
} from "@/dominio/entrenamiento";
import { nombreAtributo } from "@/dominio/atributos";
import { valorJugador } from "@/dominio/mercado";
import { ECONOMIA_JORNADA as E, LIGA, division, type NivelDivision } from "@/dominio/reglas";
import { bdLocal } from "./bd";
import { actividadMercadoJornada } from "./mercado";
import { publicarNoticia } from "./noticias";
import { equipoParaPartido, jugadoresEstado, planEntrenamiento, type JugadorEstado } from "./plantilla";
import { avanzarPlayoff, crearPlayoff } from "./temporada";

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

export async function movimiento(tx: Transaction, club: string, temporada: number, jornada: number | null, concepto: string, importe: number) {
  if (Math.round(importe) === 0) return;
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

/** Actualización en bloque del estado de muchos jugadores (una sola consulta). */
interface CambioJugador {
  id: string;
  cansancio: number;
  forma: number;
  moral: number;
  jornadas_lesion: number;
  tipo_lesion: string | null;
  atributos?: Record<string, number>;
  progreso?: Record<string, number>;
  cambios_semana?: Record<string, number>;
  media?: number;
  valor_mercado?: number;
}

async function guardarEstados(tx: Transaction, cambios: CambioJugador[]) {
  if (cambios.length === 0) return;
  await tx.query(
    `update jugadores j set
        cansancio = v.cansancio, forma = v.forma, moral = v.moral, jornadas_lesion = v.jornadas_lesion, tipo_lesion = v.tipo_lesion,
        atributos = coalesce(v.atributos, j.atributos), progreso = coalesce(v.progreso, j.progreso),
        cambios_semana = coalesce(v.cambios_semana, j.cambios_semana), media = coalesce(v.media, j.media),
        valor_mercado = coalesce(v.valor_mercado, j.valor_mercado)
       from jsonb_to_recordset($1::jsonb) as v(id uuid, cansancio numeric, forma int, moral int, jornadas_lesion int, tipo_lesion text,
            atributos jsonb, progreso jsonb, cambios_semana jsonb, media numeric, valor_mercado bigint)
      where j.id = v.id`,
    [JSON.stringify(cambios)],
  );
}

const limitar = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const nombreDe = (j: { nombre: string; apellido: string }) => `${j.nombre} ${j.apellido}`;

interface PartidoPendiente {
  id: string;
  competicion: "liga" | "playoff";
  ronda: string | null;
  grupo: number | null;
  division: NivelDivision;
  local: string;
  visitante: string;
  semilla: number;
}

/** Simula un partido y aplica todas sus consecuencias. Devuelve los lesionados en el partido. */
async function jugarPartido(tx: Transaction, t: { id: number }, jornada: number, p: PartidoPendiente): Promise<Set<string>> {
  const prep = [await equipoParaPartido(tx, p.local), await equipoParaPartido(tx, p.visitante)];
  const [local, visitante] = prep.map((x) => x.equipo) as [EquipoPartido, EquipoPartido];
  const r = simularPartido(local, visitante, p.semilla);
  const rng = crearRng(p.semilla + 1);

  // Avisos de alineación: el segundo entrenador tuvo que cubrir bajas.
  for (const [i, x] of prep.entries()) {
    if (x.sustituciones.length === 0) continue;
    const equipo = i === 0 ? local : visitante;
    const nombres = x.sustituciones.map((s) => equipo.titulares.find((j) => j.id === s.entra)?.nombre).filter(Boolean);
    await publicarNoticia(tx, equipo.id, "alineacion", "Cambios en el once por bajas",
      `Había bajas en el once guardado. El segundo entrenador ha alineado a ${nombres.join(", ")}.`, jornada);
  }

  // Playoff: si hay empate, penaltis.
  let ganador: string | null = null;
  const eventos = [...r.eventos];
  if (p.competicion === "playoff") {
    if (r.goles[0] !== r.goles[1]) ganador = r.goles[0] > r.goles[1] ? p.local : p.visitante;
    else {
      ganador = rng() < 0.5 ? p.local : p.visitante;
      const nombre = ganador === p.local ? local.nombre : visitante.nombre;
      eventos.splice(eventos.length - 1, 0, { minuto: 90, tipo: "final", texto: `Empate tras los 90 minutos: ${nombre} gana en los penaltis` });
    }
  }

  // Taquilla y restauración del local
  const club = (
    await tx.query<{ masa: number; aforo: number; puntos: number }>(
      `select c.masa_social as masa, coalesce(sum(s.aforo), 0)::int as aforo, coalesce(sum(s.puntos_venta), 0)::int as puntos
         from clubes c left join sectores_estadio s on s.club_id = c.id where c.id = $1 group by c.id`,
      [p.local],
    )
  ).rows[0];
  const extraPlayoff = p.competicion === "playoff" ? 1.4 : 1;
  const demanda = (club.masa * E.demandaPorSocio + E.publicoOcasional) * extraPlayoff * uniforme(rng, 0.85, 1.15);
  const asistencia = Math.min(club.aforo, Math.round(demanda));
  const atendidos = Math.min(asistencia, club.puntos * E.aforoPorPuntoVenta);

  await tx.query(
    `update partidos set estado = 'finalizado', minuto = 90, goles_local = $2, goles_visitante = $3,
            estadisticas = $4::jsonb, eventos = $5::jsonb, asistencia = $6, ganador_id = $7 where id = $1`,
    [p.id, r.goles[0], r.goles[1], JSON.stringify({ tiros: r.tiros, posesion: r.posesion, xg: r.xg }), JSON.stringify(eventos), asistencia, ganador],
  );
  for (const eq of [local, visitante]) {
    await tx.query(
      `insert into planteamientos (partido_id, club_id, titulares, banquillo, mentalidad, presion)
       values ($1, $2, $3::uuid[], $4::uuid[], $5::mentalidad, $6::presion)
       on conflict (partido_id, club_id) do update set titulares = excluded.titulares, banquillo = excluded.banquillo`,
      [p.id, eq.id, eq.titulares.map((j) => j.id), eq.banquillo.map((j) => j.id), eq.tactica.mentalidad, eq.tactica.presion],
    );
  }
  if (p.competicion === "liga" && p.grupo != null) {
    await sumarClasificacion(tx, t.id, p.grupo, p.local, r.goles[0], r.goles[1]);
    await sumarClasificacion(tx, t.id, p.grupo, p.visitante, r.goles[1], r.goles[0]);
  }
  await movimiento(tx, p.local, t.id, jornada, "Taquilla", asistencia * E.precioEntrada[p.division]);
  await movimiento(tx, p.local, t.id, jornada, "Restauración", atendidos * E.gastoRestauracion);

  // Estado de los jugadores tras el partido: cansancio, forma, moral y lesiones.
  const goleadores = new Map<string, number>();
  for (const e of r.eventos) if (e.tipo === "gol" && e.jugadorId) goleadores.set(e.jugadorId, (goleadores.get(e.jugadorId) ?? 0) + 1);
  const participantes = new Set(r.participantes);
  const lesionados = new Set<string>();
  const cambios: CambioJugador[] = [];
  for (const [i, clubId] of [p.local, p.visitante].entries()) {
    const resultado = r.goles[i] > r.goles[1 - i] ? "G" : r.goles[i] === r.goles[1 - i] ? "E" : "P";
    const preparador = await calidadPuesto(tx, clubId, "preparador_fisico");
    for (const j of await jugadoresEstado(tx, clubId)) {
      if (participantes.has(j.id)) {
        let jornadasLesion = j.jornadasLesion;
        let tipoLesion = j.tipoLesion;
        const cansancio = r.cansancioFinal[j.id] ?? j.cansancio;
        const riesgo = (ESTADO_FISICO.riesgoPartidoBase + ESTADO_FISICO.riesgoPartidoCansancio * cansancio) * (1 - preparador / 300);
        if (rng() < riesgo) {
          const l = sortearLesion(rng);
          jornadasLesion = l.jornadas;
          tipoLesion = l.tipo;
          lesionados.add(j.id);
          await publicarNoticia(tx, clubId, "lesion", `Lesión de ${nombreDe(j)}`,
            `${l.tipo} en el partido de la jornada ${jornada}. Estará ${l.jornadas === 1 ? "una jornada" : `${l.jornadas} jornadas`} de baja.`, jornada);
        }
        cambios.push({
          id: j.id,
          cansancio,
          forma: limitar(j.forma + variacionForma(rng, resultado, goleadores.get(j.id) ?? 0), 10, 90),
          moral: limitar(j.moral + (resultado === "G" ? 3 : resultado === "E" ? 1 : -1), 10, 95),
          jornadas_lesion: jornadasLesion,
          tipo_lesion: tipoLesion,
        });
      } else if (j.jornadasLesion === 0) {
        // Quien no juega pierde ritmo; los ambiciosos lo llevan peor.
        cambios.push({
          id: j.id,
          cansancio: j.cansancio,
          forma: Math.round(j.forma + (50 - j.forma) * 0.15 - 1),
          moral: limitar(j.moral - (j.personalidad === "ambicioso" ? 3 : j.personalidad === "conflictivo" ? 2 : 1), 10, 95),
          jornadas_lesion: 0,
          tipo_lesion: null,
        });
      }
    }
  }
  await guardarEstados(tx, cambios);
  return lesionados;
}

async function calidadPuesto(tx: Transaction, clubId: string, puesto: string): Promise<number> {
  const r = (await tx.query<{ c: number | null }>("select max(calidad)::int as c from personal where club_id = $1 and puesto = $2::puesto_personal", [clubId, puesto])).rows[0];
  return r?.c ?? 30;
}

/**
 * Días entre partidos: entrenamientos (progreso, cansancio y riesgo de lesión), recuperación,
 * altas médicas e informe semanal para el mánager.
 */
async function entreJornadas(tx: Transaction, t: { id: number }, jornada: number, lesionadosEnPartido: Set<string>, rng: Rng) {
  const { dias, diasHastaPartido } = despuesDeJornada(jornada);
  const inicioSemana = dias.includes("martes");
  const clubes = (
    await tx.query<{ id: string; humano: boolean; ciudad: number }>(
      `select c.id, c.manager_id is not null as humano,
              coalesce((select e.nivel from edificios e where e.club_id = c.id and e.tipo = 'ciudad_deportiva'), 1)::int as ciudad
         from clubes c join grupos g on g.id = c.grupo_id where g.abierto`,
    )
  ).rows;
  const cambios: CambioJugador[] = [];
  for (const club of clubes) {
    const plan = await planEntrenamiento(tx, club.id);
    const tecnicos = (await tx.query<{ c: number | null }>("select avg(calidad)::int as c from personal where club_id = $1", [club.id])).rows[0]?.c ?? 30;
    const preparador = await calidadPuesto(tx, club.id, "preparador_fisico");
    const jugadores = await jugadoresEstado(tx, club.id);
    const altas: JugadorEstado[] = [];
    const lesionesEntreno: { j: JugadorEstado; tipo: string; jornadas: number }[] = [];
    for (const j of jugadores) {
      const semana: Record<string, number> = inicioSemana ? {} : { ...j.cambiosSemana };
      const entrenable = {
        posicion: j.posicion,
        edad: j.edad,
        atributos: { ...j.atributos },
        progreso: { ...j.progreso },
        potencial: j.potencial,
        media: j.media,
        personalidad: j.personalidad,
        foco: j.foco,
        cansancio: j.cansancio,
      };
      let jornadasLesion = j.jornadasLesion;
      let tipoLesion = j.tipoLesion;
      // La baja se descuenta por jornada disputada (salvo si la lesión es de este mismo partido).
      if (jornadasLesion > 0 && !lesionadosEnPartido.has(j.id)) {
        jornadasLesion -= 1;
        if (jornadasLesion === 0) {
          tipoLesion = null;
          altas.push(j);
        }
      }
      for (const dia of dias) {
        if (jornadasLesion > 0) break; // Los lesionados no entrenan.
        const sesion = plan[dia];
        const ganados = aplicarSesion(entrenable, sesion, { calidadTecnicos: tecnicos, nivelCiudad: club.ciudad });
        for (const [a, v] of Object.entries(ganados)) semana[a] = (semana[a] ?? 0) + v;
        if (sesion.enfoque !== "recuperacion" && rng() < ESTADO_FISICO.riesgoSesion[sesion.intensidad] * (1 + entrenable.cansancio)) {
          const l = sortearLesion(rng);
          jornadasLesion = Math.max(1, Math.ceil(l.jornadas / 2));
          tipoLesion = l.tipo;
          lesionesEntreno.push({ j, tipo: l.tipo, jornadas: jornadasLesion });
        }
      }
      const media = mediaJugador(entrenable.atributos);
      cambios.push({
        id: j.id,
        cansancio: recuperar(entrenable.cansancio, diasHastaPartido, preparador),
        forma: j.forma,
        moral: j.moral,
        jornadas_lesion: jornadasLesion,
        tipo_lesion: tipoLesion,
        atributos: entrenable.atributos,
        progreso: entrenable.progreso,
        cambios_semana: semana,
        media,
        valor_mercado: media !== j.media ? valorJugador(media, j.edad) : undefined,
      });
    }

    if (club.humano) {
      for (const j of altas) await publicarNoticia(tx, club.id, "lesion", `${nombreDe(j)} recibe el alta`, "Ya está disponible para jugar.", jornada);
      for (const l of lesionesEntreno) {
        await publicarNoticia(tx, club.id, "lesion", `Lesión de ${nombreDe(l.j)} en el entrenamiento`,
          `${l.tipo}. Estará ${l.jornadas === 1 ? "una jornada" : `${l.jornadas} jornadas`} de baja.`, jornada);
      }
      // Informe semanal al terminar la semana (tras la sesión del domingo).
      if (dias.includes("domingo")) {
        const porJugador = cambios
          .filter((c) => jugadores.some((j) => j.id === c.id))
          .map((c) => {
            const j = jugadores.find((x) => x.id === c.id)!;
            const total = Object.values(c.cambios_semana ?? {}).reduce((a, v) => a + v, 0);
            return { j, total, detalle: c.cambios_semana ?? {} };
          });
        const mejoran = porJugador.filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
        const empeoran = porJugador.filter((x) => x.total < 0);
        const enfoques = [...new Set(Object.values(plan).map((s) => NOMBRE_ENFOQUE[s.enfoque].toLowerCase()))].join(", ");
        const destacados = mejoran
          .slice(0, 3)
          .map((x) => `${nombreDe(x.j)} (${Object.entries(x.detalle).filter(([, v]) => v > 0).map(([a, v]) => `+${v} ${nombreAtributo(a).toLowerCase()}`).join(", ")})`)
          .join("; ");
        const texto =
          mejoran.length > 0
            ? `Semana de trabajo ${enfoques}. Mejoran ${mejoran.length} jugadores. Destacan: ${destacados}.` +
              (empeoran.length > 0 ? ` ${empeoran.length} veteranos pierden algo de físico.` : "")
            : `Semana de trabajo ${enfoques}. Sin cambios visibles todavía: el progreso se nota con las semanas.`;
        await publicarNoticia(tx, club.id, "entrenamiento", "Informe semanal de entrenamiento", texto, jornada);
      }
    }
  }
  await guardarEstados(tx, cambios);
}

export interface ResultadoJornada {
  jornada: number;
  partidos: number;
  terminada: boolean;
}

/** Juega la siguiente jornada pendiente (liga o playoff) en todos los grupos abiertos. */
export async function jugarSiguienteJornada(): Promise<ResultadoJornada | null> {
  await asegurarCalendario();
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const t = (await tx.query<{ id: number; numero: number; fase: string }>("select id, numero, fase from temporadas where actual")).rows[0];
    if (!t) return null;
    const siguiente = (
      await tx.query<{ jornada: number | null }>(
        "select min(jornada)::int as jornada from partidos where temporada_id = $1 and competicion in ('liga', 'playoff') and estado <> 'finalizado'",
        [t.id],
      )
    ).rows[0].jornada;
    if (siguiente == null) return { jornada: LIGA.jornadas, partidos: 0, terminada: true };

    const partidos = (
      await tx.query<PartidoPendiente>(
        `select p.id, p.competicion, p.ronda, p.grupo_id as grupo, coalesce(g.division, gl.division, 5)::int as division,
                p.local_id as local, p.visitante_id as visitante, p.semilla::float8 as semilla
           from partidos p
           left join grupos g on g.id = p.grupo_id
           left join clubes cl on cl.id = p.local_id left join grupos gl on gl.id = cl.grupo_id
          where p.temporada_id = $1 and p.competicion in ('liga', 'playoff') and p.jornada = $2 and p.estado <> 'finalizado'`,
        [t.id, siguiente],
      )
    ).rows;

    const lesionados = new Set<string>();
    for (const p of partidos) for (const id of await jugarPartido(tx, t, siguiente, p)) lesionados.add(id);

    // Cierre de semana de liga (jornada del sábado): salarios, televisión y patrocinio.
    const deLiga = partidos.some((p) => p.competicion === "liga");
    if (deLiga && siguiente % 2 === 0) {
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

    const rng = crearRng(Math.floor(partidos[0]?.semilla ?? 1) + 7);
    await entreJornadas(tx, t, siguiente, lesionados, rng);
    await actividadMercadoJornada(tx, t.id, siguiente, rng);

    // Fin de la liga: arranca el playoff. Tras cada ronda de playoff, la siguiente.
    if (deLiga && siguiente >= LIGA.jornadas) await crearPlayoff(tx, t.id);
    else if (!deLiga) await avanzarPlayoff(tx, t.id);

    const quedan = (
      await tx.query<{ n: number }>(
        "select count(*)::int as n from partidos where temporada_id = $1 and competicion in ('liga', 'playoff') and estado <> 'finalizado'",
        [t.id],
      )
    ).rows[0].n;
    return { jornada: siguiente, partidos: partidos.length, terminada: quedan === 0 };
  });
}

/** Juega varias jornadas seguidas (o hasta el final de la temporada, playoff incluido). */
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
