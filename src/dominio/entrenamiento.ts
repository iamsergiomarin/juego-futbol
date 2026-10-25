/**
 * Entrenamiento, estado físico y lesiones.
 *
 * Las sesiones se hacen los días sin partido del primer equipo: martes, jueves y viernes
 * (antes del sábado) y domingo (antes del lunes). Cada sesión tiene enfoque e intensidad.
 */
import type { Atributo, Posicion, Rng } from "@/motor";
import { gauss, uniforme } from "@/motor";

export type Enfoque = "fisico" | "tecnico" | "tactico" | "balon_parado" | "recuperacion";
export type Intensidad = "suave" | "normal" | "intensa";
export type DiaEntreno = "martes" | "jueves" | "viernes" | "domingo";
export type Foco = "tecnico" | "fisico" | "tactico" | "porteria";

export const DIAS: DiaEntreno[] = ["martes", "jueves", "viernes", "domingo"];

export const NOMBRE_ENFOQUE: Record<Enfoque, string> = {
  fisico: "Físico",
  tecnico: "Técnico",
  tactico: "Táctico",
  balon_parado: "Balón parado",
  recuperacion: "Recuperación",
};

export const NOMBRE_INTENSIDAD: Record<Intensidad, string> = { suave: "Suave", normal: "Normal", intensa: "Intensa" };
export const NOMBRE_FOCO: Record<Foco, string> = { tecnico: "Técnico", fisico: "Físico", tactico: "Táctico", porteria: "Portería" };

export interface Sesion {
  enfoque: Enfoque;
  intensidad: Intensidad;
}

export type PlanEntrenamiento = Record<DiaEntreno, Sesion>;

export const PLAN_POR_DEFECTO: PlanEntrenamiento = {
  martes: { enfoque: "fisico", intensidad: "normal" },
  jueves: { enfoque: "tecnico", intensidad: "normal" },
  viernes: { enfoque: "tactico", intensidad: "suave" },
  domingo: { enfoque: "recuperacion", intensidad: "suave" },
};

/** Atributos que trabaja cada enfoque o foco. */
const GRUPOS: Record<Foco | "balon_parado", Atributo[]> = {
  tecnico: ["pase", "regate", "tiro", "control", "centros"],
  fisico: ["velocidad", "resistencia", "fuerza"],
  tactico: ["vision", "colocacion", "decision", "entrada", "aereo", "temple"],
  balon_parado: ["centros", "tiro", "aereo"],
  porteria: ["reflejos", "blocaje", "salidas", "juegoPies"],
};

/** Atributos de un grupo que tiene realmente el jugador (los porteros tienen los suyos). */
export function atributosDeGrupo(grupo: Foco | "balon_parado", atributos: Record<string, number>, posicion: Posicion): Atributo[] {
  if (posicion === "POR") {
    const propio = grupo === "tecnico" || grupo === "porteria" || grupo === "balon_parado" ? GRUPOS.porteria : GRUPOS[grupo];
    return propio.filter((a) => a in atributos);
  }
  if (grupo === "porteria") return [];
  return GRUPOS[grupo].filter((a) => a in atributos);
}

/** Sesiones y días de descanso que hay tras cada jornada hasta la siguiente. */
export function despuesDeJornada(jornada: number): { dias: DiaEntreno[]; diasHastaPartido: number } {
  // Jornada impar = lunes → martes, jueves y viernes antes del sábado. Par = sábado → domingo.
  return jornada % 2 === 1 ? { dias: ["martes", "jueves", "viernes"], diasHastaPartido: 5 } : { dias: ["domingo"], diasHastaPartido: 2 };
}

export const ESTADO_FISICO = {
  /** Cansancio que añade una sesión según su intensidad. */
  cansancioSesion: { suave: 0.03, normal: 0.06, intensa: 0.1 } as Record<Intensidad, number>,
  /** Recuperación extra de una sesión de recuperación. */
  recuperacionSesion: 0.1,
  /** Recuperación por día; el preparador físico añade hasta un 50 % más. */
  recuperacionDia: 0.11,
  /** Probabilidad de lesión por sesión. */
  riesgoSesion: { suave: 0.0004, normal: 0.0012, intensa: 0.0035 } as Record<Intensidad, number>,
  /** Probabilidad de lesión por partido jugado: base + extra según el cansancio al acabar. */
  riesgoPartidoBase: 0.006,
  riesgoPartidoCansancio: 0.02,
} as const;

/** Progreso por sesión según la edad (en puntos de atributo). */
export function ritmoPorEdad(edad: number): number {
  if (edad <= 21) return 0.12;
  if (edad <= 24) return 0.08;
  if (edad <= 27) return 0.04;
  if (edad <= 30) return 0.015;
  return 0;
}

const FACTOR_INTENSIDAD: Record<Intensidad, number> = { suave: 0.6, normal: 1, intensa: 1.4 };
const FACTOR_PERSONALIDAD: Record<string, number> = { profesional: 1.2, lider: 1.05, ambicioso: 1.1, normal: 1, timido: 0.95, conflictivo: 0.8 };

export interface JugadorEntrenable {
  posicion: Posicion;
  edad: number;
  atributos: Record<string, number>;
  progreso: Record<string, number>;
  potencial: number;
  media: number;
  personalidad: string;
  foco: Foco | null;
  cansancio: number;
}

export interface ContextoSesion {
  /** Calidad media del cuerpo técnico (1-100). */
  calidadTecnicos: number;
  /** Nivel de la ciudad deportiva (1-5). */
  nivelCiudad: number;
}

/**
 * Aplica una sesión de entrenamiento: progreso en los atributos trabajados (con techo en el
 * potencial), declive físico de los veteranos y cansancio. Devuelve los puntos ganados o perdidos.
 */
export function aplicarSesion(j: JugadorEntrenable, sesion: Sesion, ctx: ContextoSesion): Record<string, number> {
  const cambios: Record<string, number> = {};
  const sumar = (atributo: string, cantidad: number) => {
    if (!(atributo in j.atributos)) return;
    const acumulado = (j.progreso[atributo] ?? 0) + cantidad;
    const entero = acumulado >= 1 ? Math.floor(acumulado) : acumulado <= -1 ? Math.ceil(acumulado) : 0;
    j.progreso[atributo] = Math.round((acumulado - entero) * 1000) / 1000;
    if (entero !== 0) {
      const nuevo = Math.max(1, Math.min(100, j.atributos[atributo] + entero));
      const real = nuevo - j.atributos[atributo];
      j.atributos[atributo] = nuevo;
      if (real !== 0) cambios[atributo] = (cambios[atributo] ?? 0) + real;
    }
  };

  if (sesion.enfoque === "recuperacion") {
    j.cansancio = Math.max(0, j.cansancio - ESTADO_FISICO.recuperacionSesion);
  } else {
    j.cansancio = Math.min(1, j.cansancio + ESTADO_FISICO.cansancioSesion[sesion.intensidad]);
    // Cerca del techo de potencial apenas se mejora.
    const margen = j.potencial - j.media * 10;
    const techo = margen <= 0 ? 0.05 : margen < 5 ? 0.4 : 1;
    const base =
      ritmoPorEdad(j.edad) *
      FACTOR_INTENSIDAD[sesion.intensidad] *
      (FACTOR_PERSONALIDAD[j.personalidad] ?? 1) *
      (0.7 + ctx.calidadTecnicos / 100) *
      (1 + 0.1 * (ctx.nivelCiudad - 1)) *
      techo;
    // Lo que trabaja todo el equipo…
    for (const a of atributosDeGrupo(sesion.enfoque, j.atributos, j.posicion)) sumar(a, base);
    // …y el foco individual, que se trabaja en todas las sesiones.
    if (j.foco) for (const a of atributosDeGrupo(j.foco, j.atributos, j.posicion)) sumar(a, base * 0.8);
  }
  // Los veteranos pierden físico poco a poco, entrenen lo que entrenen.
  if (j.edad >= 31) {
    const declive = 0.015 + 0.01 * (j.edad - 31);
    for (const a of ["velocidad", "resistencia", "fuerza"]) sumar(a, -declive);
  }
  return cambios;
}

/** Recuperación de los días de descanso. */
export function recuperar(cansancio: number, dias: number, calidadPreparador: number): number {
  const porDia = ESTADO_FISICO.recuperacionDia * (1 + calidadPreparador / 200);
  return Math.max(0, Math.round((cansancio - porDia * dias) * 100) / 100);
}

const TIPOS_LESION: { tipo: string; min: number; max: number; peso: number }[] = [
  { tipo: "Sobrecarga muscular", min: 1, max: 1, peso: 30 },
  { tipo: "Esguince de tobillo", min: 1, max: 3, peso: 25 },
  { tipo: "Rotura de fibras", min: 3, max: 6, peso: 20 },
  { tipo: "Contusión", min: 1, max: 2, peso: 15 },
  { tipo: "Lesión de rodilla", min: 6, max: 12, peso: 10 },
];

/** Tipo de lesión y jornadas de baja. */
export function sortearLesion(rng: Rng): { tipo: string; jornadas: number } {
  let r = rng() * TIPOS_LESION.reduce((a, t) => a + t.peso, 0);
  for (const t of TIPOS_LESION) {
    r -= t.peso;
    if (r <= 0) return { tipo: t.tipo, jornadas: Math.round(uniforme(rng, t.min, t.max)) };
  }
  return { tipo: "Sobrecarga muscular", jornadas: 1 };
}

/** Variación de forma tras un partido (0-100, 50 = normal). */
export function variacionForma(rng: Rng, resultado: "G" | "E" | "P", goles: number): number {
  const base = resultado === "G" ? 4 : resultado === "E" ? 0 : -4;
  return Math.round(base + goles * 3 + gauss(rng, 0, 3));
}
