/** Filial (puro): calendario de domingos, alineación con relleno y fuerza de los filiales de los bots. */
import { calendarioDobleVuelta, type Emparejamiento } from "./calendario";
import { gauss, generarJugador, type EquipoPartido, type JugadorPartido, type Posicion, type Rng } from "@/motor";
import { FILIAL } from "./reglas";

export interface JugadorFilial {
  id: string;
  nombre: string;
  posicion: Posicion;
  atributos: Record<string, number>;
  media: number;
}

/** Una sola vuelta: 19 jornadas de un grupo de 20. */
export function calendarioFilial(clubes: string[], rng: Rng): Emparejamiento[] {
  return calendarioDobleVuelta(clubes, rng).filter((e) => e.jornada <= FILIAL.jornadas);
}

/** Fecha (AAAA-MM-DD) del domingo de la jornada: el calendario de liga empieza en lunes. */
export function fechaDomingo(inicioTemporada: string, jornada: number): string {
  const d = new Date(`${inicioTemporada}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6 + 7 * (jornada - 1));
  return d.toISOString().slice(0, 10);
}

/** Media del filial de un club sin mánager. */
export function mediaFilialBot(mediaClub: number, rng: Rng): number {
  return Math.max(1.5, gauss(rng, mediaClub - FILIAL.descuentoBot, 0.3));
}

const HUECOS: [Posicion, number][] = [["POR", 1], ["DEF", 4], ["MED", 4], ["DEL", 2]];
const BANQUILLO: Posicion[] = ["DEF", "MED", "MED", "DEL", "DEL"];

/**
 * Alinea el filial en 4-4-2: los mejores de cada puesto y, donde falta gente, jóvenes de relleno de la zona.
 * Devuelve también quiénes de los reales juegan, para darles minutos.
 */
export function armarFilial(rng: Rng, id: string, nombre: string, reales: JugadorFilial[], nivelRelleno: number): { equipo: EquipoPartido; juegan: string[]; relleno: number } {
  const orden = [...reales].sort((a, b) => b.media - a.media);
  const usados = new Set<string>();
  let relleno = 0;
  const nuevoRelleno = (pos: Posicion, nivel: number): JugadorPartido => generarJugador(rng, `${id}-R${++relleno}`, "Joven de la zona", pos, nivel);
  const aMotor = (j: JugadorFilial, pos: Posicion): JugadorPartido => ({
    id: j.id,
    nombre: j.nombre,
    posicion: pos,
    atributos: Object.fromEntries(Object.entries(j.atributos).map(([k, v]) => [k, Math.max(1, Math.min(100, Math.round(v)))])),
  });

  const titulares: JugadorPartido[] = [];
  for (const [pos, n] of HUECOS) {
    const propios = orden.filter((j) => j.posicion === pos && !usados.has(j.id)).slice(0, n);
    for (const j of propios) {
      usados.add(j.id);
      titulares.push(aMotor(j, pos));
    }
    for (let i = propios.length; i < n; i++) titulares.push(nuevoRelleno(pos, nivelRelleno));
  }
  const banquillo: JugadorPartido[] = [];
  for (const pos of BANQUILLO) {
    const j = orden.find((x) => x.posicion === pos && !usados.has(x.id)) ?? orden.find((x) => !usados.has(x.id));
    if (j) {
      usados.add(j.id);
      banquillo.push(aMotor(j, pos === j.posicion ? pos : j.posicion));
    } else banquillo.push(nuevoRelleno(pos, nivelRelleno - 0.3));
  }
  const juegan = [...usados];
  return {
    equipo: { id, nombre, titulares, banquillo, tactica: { mentalidad: "equilibrada", presion: "normal" }, familiaridad: 0.7, condicionales: [], segundoEntrenador: true },
    juegan,
    relleno,
  };
}
