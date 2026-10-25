import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { EquipoPartido, JugadorPartido, Posicion } from "@/motor";
import { PLAN_POR_DEFECTO, type Foco, type PlanEntrenamiento } from "@/dominio/entrenamiento";
import {
  completarPlanteamiento,
  factorPosicion,
  planteamientoPorDefecto,
  puestos,
  validarPlanteamiento,
  type JugadorAlineable,
  type Planteamiento,
} from "@/dominio/tactica";
import { bdLocal } from "./bd";

type Consulta = PGlite | Transaction;

export interface JugadorEstado {
  id: string;
  nombre: string;
  apellido: string;
  dorsal: number | null;
  posicion: Posicion;
  atributos: Record<string, number>;
  progreso: Record<string, number>;
  cambiosSemana: Record<string, number>;
  media: number;
  potencial: number;
  personalidad: string;
  edad: number;
  forma: number;
  moral: number;
  cansancio: number;
  jornadasLesion: number;
  tipoLesion: string | null;
  foco: Foco | null;
  salario: number;
  valor: number;
  contratoHasta: number | null;
  precioVenta: number | null;
}

/** Plantilla del primer equipo con su estado físico, de la temporada en curso. */
export async function jugadoresEstado(bd: Consulta, clubId: string): Promise<JugadorEstado[]> {
  const { rows } = await bd.query<JugadorEstado>(
    `select j.id, j.nombre, j.apellido, j.dorsal, j.posicion, j.atributos, j.progreso, j.cambios_semana as "cambiosSemana",
            j.media::float8 as media, j.potencial, j.personalidad,
            date_part('year', age((select inicio from temporadas where actual), j.fecha_nacimiento))::int as edad,
            j.forma, j.moral, j.cansancio::float8 as cansancio, j.jornadas_lesion as "jornadasLesion", j.tipo_lesion as "tipoLesion",
            j.foco, j.salario::float8 as salario, j.valor_mercado::float8 as valor, j.contrato_hasta as "contratoHasta",
            j.precio_venta::float8 as "precioVenta"
       from jugadores j
      where j.club_id = $1 and j.ficha = 'primer_equipo' and not j.retirado
      order by array_position(array['POR','DEF','MED','DEL']::posicion[], j.posicion), j.media desc`,
    [clubId],
  );
  return rows;
}

export function alineables(jugadores: JugadorEstado[]): JugadorAlineable[] {
  return jugadores.map((j) => ({
    id: j.id,
    posicion: j.posicion,
    media: j.media,
    cansancio: j.cansancio,
    disponible: j.jornadasLesion === 0,
  }));
}

/** Planteamiento guardado del club, o el que haría el segundo entrenador. */
export async function planteamientoClub(bd: Consulta, clubId: string, jugadores?: JugadorEstado[]): Promise<Planteamiento> {
  const guardado = (await bd.query<{ p: Planteamiento | null }>("select planteamiento as p from clubes where id = $1", [clubId])).rows[0]?.p;
  const lista = jugadores ?? (await jugadoresEstado(bd, clubId));
  if (guardado && guardado.formacion && Array.isArray(guardado.once)) return guardado;
  return planteamientoPorDefecto(alineables(lista));
}

export class ErrorPlanteamiento extends Error {}

export async function guardarPlanteamiento(clubId: string, p: Planteamiento): Promise<void> {
  const bd = await bdLocal();
  const jugadores = await jugadoresEstado(bd, clubId);
  const errores = validarPlanteamiento(p, new Set(jugadores.map((j) => j.id)));
  if (errores.length > 0) throw new ErrorPlanteamiento(errores.join(" "));
  await bd.query("update clubes set planteamiento = $2::jsonb where id = $1", [clubId, JSON.stringify(p)]);
}

export async function planEntrenamiento(bd: Consulta, clubId: string): Promise<PlanEntrenamiento> {
  const guardado = (await bd.query<{ e: PlanEntrenamiento | null }>("select entrenamiento as e from clubes where id = $1", [clubId])).rows[0]?.e;
  return { ...PLAN_POR_DEFECTO, ...(guardado ?? {}) };
}

export async function guardarEntrenamiento(clubId: string, plan: PlanEntrenamiento, focos: Record<string, Foco | null>): Promise<void> {
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    await tx.query("update clubes set entrenamiento = $2::jsonb where id = $1", [clubId, JSON.stringify(plan)]);
    for (const [jugador, foco] of Object.entries(focos)) {
      await tx.query("update jugadores set foco = $3 where id = $1 and club_id = $2", [jugador, clubId, foco]);
    }
  });
}

/** Rendimiento según forma y moral (±5 % y ±3 %). */
function factorEstado(forma: number, moral: number): number {
  return 1 + (forma - 50) / 1000 + (moral - 50) / 1500;
}

function ajustarAtributos(atributos: Record<string, number>, factor: number): Record<string, number> {
  if (factor === 1) return atributos;
  return Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k, Math.max(1, Math.min(100, Math.round(v * factor)))]));
}

/**
 * Equipo listo para el motor: planteamiento del club (o el automático en los bots),
 * lesionados fuera, penalización fuera de posición y estado físico de cada jugador.
 */
export async function equipoParaPartido(
  bd: Consulta,
  clubId: string,
): Promise<{ equipo: EquipoPartido; sustituciones: { sale: string; entra: string }[] }> {
  const club = (
    await bd.query<{ nombre: string; humano: boolean }>("select nombre, manager_id is not null as humano from clubes where id = $1", [clubId])
  ).rows[0];
  const jugadores = await jugadoresEstado(bd, clubId);
  const lista = alineables(jugadores);
  const base = club.humano ? await planteamientoClub(bd, clubId, jugadores) : planteamientoPorDefecto(lista);
  const { planteamiento, sustituciones } = completarPlanteamiento(base, lista);
  const porId = new Map(jugadores.map((j) => [j.id, j]));

  const aMotor = (j: JugadorEstado, puesto: Posicion): JugadorPartido => ({
    id: j.id,
    nombre: `${j.nombre} ${j.apellido}`,
    posicion: puesto,
    atributos: ajustarAtributos(j.atributos, factorPosicion(j.posicion, puesto) * factorEstado(j.forma, j.moral)),
    cansancioInicial: j.cansancio,
  });

  const huecos = puestos(planteamiento.formacion);
  const titulares = planteamiento.once
    .map((id, i) => (id && porId.has(id) ? aMotor(porId.get(id)!, huecos[i]) : null))
    .filter((j): j is JugadorPartido => j !== null);
  const banquillo = planteamiento.banquillo.filter((id) => porId.has(id)).map((id) => aMotor(porId.get(id)!, porId.get(id)!.posicion));

  return {
    equipo: {
      id: clubId,
      nombre: club.nombre,
      titulares,
      banquillo,
      tactica: { mentalidad: planteamiento.mentalidad, presion: planteamiento.presion },
      familiaridad: 0.8,
      condicionales: planteamiento.condicionales,
      segundoEntrenador: true,
    },
    sustituciones,
  };
}
