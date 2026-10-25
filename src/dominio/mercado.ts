/**
 * Valor de mercado, salarios y reglas de fichajes.
 */
import { LIGA, MERCADO, division, valorOrientativo, type NivelDivision } from "./reglas";

export function factorEdadValor(edad: number): number {
  if (edad <= 21) return 1.6;
  if (edad <= 24) return 1.25;
  if (edad >= 33) return 0.35;
  if (edad >= 31) return 0.5;
  if (edad >= 29) return 0.8;
  return 1;
}

/** Valor de mercado redondeado a miles. */
export function valorJugador(media: number, edad: number): number {
  return Math.max(1000, Math.round((valorOrientativo(media) * factorEdadValor(edad)) / 1000) * 1000);
}

/** Salario de referencia por temporada para una media en una división. */
export function salarioReferencia(media: number, nivel: NivelDivision): number {
  const d = division(nivel);
  return Math.round((d.presupuesto * MERCADO.salarioMedio * (media / d.mediaTipica) ** 2) / 500) * 500;
}

const EXIGENCIA: Record<string, number> = { ambicioso: 1.2, conflictivo: 1.15, lider: 1.1, normal: 1.05, profesional: 1, timido: 0.95 };

/** Lo que pide un jugador para firmar o renovar. */
export function salarioPedido(j: { media: number; salario: number; personalidad: string }, nivel: NivelDivision): number {
  const base = Math.max(j.salario * 1.1, salarioReferencia(j.media, nivel));
  return Math.round((base * (EXIGENCIA[j.personalidad] ?? 1.05)) / 500) * 500;
}

export const MERCADO_LOCAL = {
  /** Plazas de ficha del primer equipo. */
  maximoPlantilla: 25,
  /** Mínimo de jugadores que un bot mantiene en plantilla. */
  minimoBot: 20,
  /** Agentes libres disponibles al empezar cada temporada. */
  agentesLibres: 30,
  /** Precio que piden los bots por sus transferibles (× valor). */
  precioBot: [1.05, 1.35] as [number, number],
} as const;

/**
 * Ventanas de fichajes (traspasos): pretemporada y semanas 9 a 11 (jornadas 17 a 22).
 * Los agentes libres se pueden fichar siempre.
 */
export function ventanaAbierta(jugadas: number, fase: string): boolean {
  if (fase === "terminada" || jugadas === 0) return true;
  return jugadas >= 16 && jugadas < 22 && jugadas < LIGA.jornadas;
}

/** Margen de error de lo que ve tu ojeador de jugadores ajenos (en puntos de atributo). */
export function margenOjeador(calidad: number): number {
  return Math.max(2, Math.round(15 - calidad * 0.13));
}

/** Rango determinista (no cambia al recargar) alrededor de un valor real. */
export function rangoAproximado(real: number, margen: number, semilla: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  const desplazamiento = ((h >>> 0) % (margen + 1));
  const bajo = Math.max(1, real - desplazamiento);
  return [bajo, Math.min(100, bajo + margen)];
}
