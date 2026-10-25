import type { Mentalidad, Presion } from "./tipos";

/**
 * Constantes de calibración del motor.
 *
 * Calibradas con el prototipo en Python (ver docs/motor.md): entre equipos iguales
 * dan unos 2,75 goles por partido, ~45 % de victorias locales y ~6 % de 0-0.
 * Cada ventaja está acotada (tanh) para que la superioridad no se multiplique sin freno.
 */
export const CALIBRACION = {
  /** Probabilidad base de tiro por minuto para el equipo con la posesión. */
  baseTirosMinuto: 0.27,
  /** Efecto máximo de ataque contra defensa sobre la probabilidad de tiro. */
  pesoAtaque: 0.55,
  /** Calidad media de un tiro (xG). */
  baseXg: 0.105,
  /** Efecto máximo de definición contra portero sobre la calidad del tiro. */
  pesoTiro: 0.45,
  /** Desviación máxima de la posesión por el centro del campo. */
  pesoPosesion: 0.18,
  /** Puntos de atributo para alcanzar ~76 % del efecto máximo. */
  escala: 30,
  /** Bonus de posesión del local. */
  ventajaLocal: 0.03,
  /** Multiplicador de peligro del local. */
  peligroLocal: 1.14,
  xgMaximo: 0.6,
  /** Pérdida de rendimiento con cansancio máximo. */
  perdidaPorCansancio: 0.28,
  /** Rendimiento durante el tiempo de adaptación tras un cambio táctico. */
  rendimientoAdaptacion: 0.92,
  /** Peso de cada jugador de más (o de menos) en una línea respecto al 4-4-2. */
  pesoPorJugadorDeLinea: 0.07,
  /** Probabilidad de que el juego se interrumpa en un minuto sin tiro. */
  probabilidadInterrupcion: 0.55,
} as const;

/** [multiplicador de peligro propio, multiplicador de peligro del rival] */
export const MENTALIDAD: Record<Mentalidad, [number, number]> = {
  defensiva: [0.75, 0.75],
  equilibrada: [1.0, 1.0],
  ofensiva: [1.2, 1.25],
};

/** [bonus de posesión, coste de cansancio] */
export const PRESION: Record<Presion, [number, number]> = {
  baja: [-0.03, 0.8],
  normal: [0, 1],
  alta: [0.045, 1.35],
};

export const REGLAS_PARTIDO = {
  minutos: 90,
  maximoCambios: 5,
  /** Ventanas de cambio, sin contar el descanso. */
  ventanasCambio: 3,
  /** Minutos en los que el segundo entrenador revisa el cansancio. */
  revisionCansancio: [65, 72, 80],
  umbralCansancio: 0.35,
} as const;
