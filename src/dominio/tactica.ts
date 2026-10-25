/**
 * Alineación y táctica: sistemas, once, banquillo, mentalidad, presión y condicionales.
 */
import type { Condicional, Mentalidad, Posicion, Presion } from "@/motor";

export const FORMACIONES = {
  "4-4-2": [4, 4, 2],
  "4-3-3": [4, 3, 3],
  "4-5-1": [4, 5, 1],
  "3-5-2": [3, 5, 2],
  "5-3-2": [5, 3, 2],
  "3-4-3": [3, 4, 3],
} as const satisfies Record<string, [number, number, number]>;

export type Formacion = keyof typeof FORMACIONES;

export const DESCRIPCION_FORMACION: Record<Formacion, string> = {
  "4-4-2": "El equilibrio de referencia.",
  "4-3-3": "Más pólvora arriba a cambio de ceder el centro del campo.",
  "4-5-1": "Dominar el medio y encajar poco; cuesta llegar.",
  "3-5-2": "Medio poblado y dos puntas, con la defensa más expuesta.",
  "5-3-2": "Cerrojo atrás: pocos goles en las dos áreas.",
  "3-4-3": "Partido abierto en las dos porterías.",
};

export const MAX_BANQUILLO = 7;
export const MAX_CONDICIONALES = 3;

/** Puestos del once en orden: portero, defensas, medios y delanteros. */
export function puestos(formacion: Formacion): Posicion[] {
  const [d, m, f] = FORMACIONES[formacion];
  return ["POR", ...Array<Posicion>(d).fill("DEF"), ...Array<Posicion>(m).fill("MED"), ...Array<Posicion>(f).fill("DEL")];
}

export interface Planteamiento {
  formacion: Formacion;
  /** Un jugador por puesto, en el orden de `puestos(formacion)`. */
  once: (string | null)[];
  banquillo: string[];
  mentalidad: Mentalidad;
  presion: Presion;
  condicionales: Condicional[];
}

/** Rendimiento de un jugador según su posición natural y el puesto que ocupa. */
export function factorPosicion(natural: Posicion, puesto: Posicion): number {
  if (natural === puesto) return 1;
  if (puesto === "POR") return 0.35;
  if (natural === "POR") return 0.45;
  const contiguo = (natural === "MED") !== (puesto === "MED");
  return contiguo ? 0.85 : 0.7;
}

export interface JugadorAlineable {
  id: string;
  posicion: Posicion;
  media: number;
  cansancio: number;
  disponible: boolean;
}

/** Valor del jugador para un puesto hoy: media, posición y cansancio. */
function puntuacion(j: JugadorAlineable, puesto: Posicion): number {
  return j.media * factorPosicion(j.posicion, puesto) * (1 - 0.35 * j.cansancio);
}

/** La alineación que haría el segundo entrenador: el mejor disponible para cada puesto. */
export function alineacionAutomatica(jugadores: JugadorAlineable[], formacion: Formacion): { once: string[]; banquillo: string[] } {
  const libres = jugadores.filter((j) => j.disponible);
  const usados = new Set<string>();
  const once: string[] = [];
  // Primero el portero, luego las líneas en orden de escasez.
  for (const puesto of puestos(formacion)) {
    const mejor = libres
      .filter((j) => !usados.has(j.id))
      .sort((a, b) => puntuacion(b, puesto) - puntuacion(a, puesto))[0];
    if (mejor) {
      usados.add(mejor.id);
      once.push(mejor.id);
    }
  }
  // Banquillo: un portero si lo hay y los mejores restantes.
  const resto = libres.filter((j) => !usados.has(j.id)).sort((a, b) => b.media - a.media);
  const porteroSuplente = resto.find((j) => j.posicion === "POR");
  const banquillo = [
    ...(porteroSuplente ? [porteroSuplente.id] : []),
    ...resto.filter((j) => j.id !== porteroSuplente?.id).map((j) => j.id),
  ].slice(0, MAX_BANQUILLO);
  return { once, banquillo };
}

export function planteamientoPorDefecto(jugadores: JugadorAlineable[]): Planteamiento {
  const { once, banquillo } = alineacionAutomatica(jugadores, "4-4-2");
  return { formacion: "4-4-2", once, banquillo, mentalidad: "equilibrada", presion: "normal", condicionales: [] };
}

/** Errores del planteamiento (vacío si es válido). */
export function validarPlanteamiento(p: Planteamiento, plantilla: Set<string>): string[] {
  const errores: string[] = [];
  if (!(p.formacion in FORMACIONES)) errores.push("Sistema no válido.");
  const huecos = puestos(p.formacion in FORMACIONES ? p.formacion : "4-4-2").length;
  if (p.once.length !== huecos || p.once.some((id) => !id)) errores.push("Falta completar el once.");
  const todos = [...p.once.filter(Boolean), ...p.banquillo] as string[];
  if (new Set(todos).size !== todos.length) errores.push("Un jugador no puede estar dos veces.");
  if (todos.some((id) => !plantilla.has(id))) errores.push("Hay jugadores que ya no están en la plantilla.");
  if (p.banquillo.length > MAX_BANQUILLO) errores.push(`Como máximo ${MAX_BANQUILLO} suplentes.`);
  if (!["defensiva", "equilibrada", "ofensiva"].includes(p.mentalidad)) errores.push("Mentalidad no válida.");
  if (!["baja", "normal", "alta"].includes(p.presion)) errores.push("Presión no válida.");
  if (p.condicionales.length > MAX_CONDICIONALES) errores.push(`Como máximo ${MAX_CONDICIONALES} instrucciones condicionales.`);
  return errores;
}

/**
 * Antes de cada partido: si alguien del planteamiento guardado no puede jugar (lesión,
 * venta), el segundo entrenador pone al mejor disponible en su puesto.
 */
export function completarPlanteamiento(
  p: Planteamiento,
  jugadores: JugadorAlineable[],
): { planteamiento: Planteamiento; sustituciones: { sale: string; entra: string }[] } {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const disponible = (id: string | null): id is string => Boolean(id && porId.get(id)?.disponible);
  // Los titulares que pueden jugar se quedan; los huecos se cubren con el mejor disponible.
  const usados = new Set<string>(p.once.filter(disponible));
  const sustituciones: { sale: string; entra: string }[] = [];
  const once = puestos(p.formacion).map((puesto, i) => {
    const actual = p.once[i] ?? null;
    if (disponible(actual)) return actual;
    const mejor = jugadores
      .filter((j) => j.disponible && !usados.has(j.id))
      .sort((a, b) => puntuacion(b, puesto) - puntuacion(a, puesto))[0];
    if (!mejor) return null;
    usados.add(mejor.id);
    if (actual) sustituciones.push({ sale: actual, entra: mejor.id });
    return mejor.id;
  });
  const banquillo = p.banquillo.filter((id) => disponible(id) && !usados.has(id));
  return { planteamiento: { ...p, once, banquillo }, sustituciones };
}
