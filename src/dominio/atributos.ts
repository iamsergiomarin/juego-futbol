import type { Atributo } from "@/motor";

export const NOMBRE_ATRIBUTO: Record<Atributo, string> = {
  pase: "Pase",
  regate: "Regate",
  tiro: "Tiro",
  control: "Control",
  centros: "Centros",
  aereo: "Juego aéreo",
  entrada: "Entrada",
  velocidad: "Velocidad",
  resistencia: "Resistencia",
  fuerza: "Fuerza",
  vision: "Visión",
  colocacion: "Colocación",
  decision: "Decisión",
  temple: "Temple",
  reflejos: "Reflejos",
  blocaje: "Blocaje",
  salidas: "Salidas",
  juegoPies: "Juego de pies",
};

/** Familias de atributos para mostrarlos agrupados. */
export const FAMILIAS: { nombre: string; atributos: Atributo[] }[] = [
  { nombre: "Técnicos", atributos: ["pase", "regate", "tiro", "control", "centros", "aereo", "entrada"] },
  { nombre: "Físicos", atributos: ["velocidad", "resistencia", "fuerza"] },
  { nombre: "Mentales", atributos: ["vision", "colocacion", "decision", "temple"] },
  { nombre: "Portería", atributos: ["reflejos", "blocaje", "salidas", "juegoPies"] },
];

export function nombreAtributo(a: string): string {
  return NOMBRE_ATRIBUTO[a as Atributo] ?? a;
}
