/** Cantera (puro): hornadas de juveniles, desarrollo semanal y coste de las obras. */
import { gauss, mediaJugador, uniforme, type Rng } from "@/motor";
import { generarJugador } from "@/motor/generador";
import { CANTERA, CANTERA_JUEGO, OBRAS_EDIFICIOS, type EdificioObra } from "./reglas";

export type PosicionJuvenil = "POR" | "DEF" | "MED" | "DEL";

export interface JuvenilNuevo {
  posicion: PosicionJuvenil;
  edad: number;
  atributos: Record<string, number>;
  media: number;
  potencial: number;
  joya: boolean;
}

/** Coste de subir un edificio al nivel de destino. */
export function costeObra(edificio: EdificioObra, nivelDestino: number): number {
  return OBRAS_EDIFICIOS.base[edificio] * nivelDestino;
}

/** Horas de obra (máximo 48). */
export function horasObra(nivelDestino: number): number {
  return Math.min(OBRAS_EDIFICIOS.horasMaximas, OBRAS_EDIFICIOS.horasBase + OBRAS_EDIFICIOS.horasPorNivel * nivelDestino);
}

const POSICIONES: PosicionJuvenil[] = ["POR", "DEF", "DEF", "MED", "MED", "DEL"];

/** Número de juveniles de una hornada según el nivel de la escuela. */
export function tamanoHornada(nivel: number, rng: Rng): number {
  const [min, max] = CANTERA[Math.max(1, Math.min(5, nivel))].juveniles;
  return min + Math.floor(rng() * (max - min + 1));
}

export function generarHornada(rng: Rng, p: { nivelEscuela: number; mediaEquipo: number; popularidad: number }): JuvenilNuevo[] {
  const n = tamanoHornada(p.nivelEscuela, rng);
  const probJoya = CANTERA_JUEGO.probabilidadJoya[Math.max(1, Math.min(5, p.nivelEscuela))] * (0.8 + 0.4 * (p.popularidad / 100));
  return Array.from({ length: n }, () => {
    const posicion = POSICIONES[Math.floor(rng() * POSICIONES.length)];
    const edad = CANTERA_JUEGO.edadMinima + Math.floor(rng() * (CANTERA_JUEGO.edadMaxima - CANTERA_JUEGO.edadMinima + 1));
    const joya = rng() < probJoya;
    const objetivo = Math.max(1.5, Math.min(7, gauss(rng, p.mediaEquipo - 1.6 + 0.15 * p.nivelEscuela - (17 - edad) * 0.2, 0.4)));
    const atributos = generarJugador(rng, "", "", posicion, objetivo).atributos as Record<string, number>;
    const media = mediaJugador(atributos);
    const techo = joya ? Math.max(media * 10 + uniforme(rng, 35, 50), p.mediaEquipo * 10 + 22) : media * 10 + uniforme(rng, 8, 32) + p.nivelEscuela * 2;
    return { posicion, edad, atributos, media, potencial: Math.round(Math.min(98, techo)), joya };
  });
}

/** Desarrollo semanal: cierra una parte de la distancia al potencial; más rápido entre los 17 y los 21. */
export function desarrollarJuvenil(atributos: Record<string, number>, potencial: number, edad: number, nivelEscuela: number): { atributos: Record<string, number>; media: number } {
  const media = mediaJugador(atributos);
  const hueco = Math.max(0, potencial - media * 10);
  const ritmo = edad >= 17 && edad <= 21 ? 1.25 : 0.8;
  const delta = hueco * CANTERA_JUEGO.crecimientoSemanal * ritmo * (0.9 + 0.1 * nivelEscuela);
  const nuevo = Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k, Math.min(100, v + delta)]));
  return { atributos: nuevo, media: mediaJugador(nuevo) };
}

/** Un juvenil "está listo" si su media se acerca a la de la plantilla. */
export const estaListo = (media: number, mediaEquipo: number) => media >= mediaEquipo - CANTERA_JUEGO.margenListo;
