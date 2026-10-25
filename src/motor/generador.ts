import { gauss, type Rng } from "./aleatorio";
import {
  ATRIBUTOS_CAMPO,
  ATRIBUTOS_PORTERO,
  type Atributo,
  type Atributos,
  type EquipoPartido,
  type JugadorPartido,
  type Posicion,
} from "./tipos";

/** Peso de cada atributo según la posición, para generar jugadores coherentes. */
const PERFIL: Record<Exclude<Posicion, "POR">, Partial<Record<Atributo, number>>> = {
  DEF: { entrada: 1.15, colocacion: 1.15, fuerza: 1.1, aereo: 1.1, regate: 0.85, tiro: 0.8 },
  MED: { pase: 1.15, vision: 1.15, control: 1.1, decision: 1.1, resistencia: 1.05, aereo: 0.9 },
  DEL: { tiro: 1.15, regate: 1.1, velocidad: 1.1, decision: 1.05, entrada: 0.8, colocacion: 0.9 },
};

const NOMBRES = [
  "Adrián", "Álvaro", "Andrés", "Carlos", "Dani", "David", "Diego", "Enrique", "Fran", "Gonzalo",
  "Héctor", "Hugo", "Iker", "Iván", "Javi", "Jorge", "Juanma", "Lucas", "Marcos", "Mario",
  "Miguel", "Nacho", "Óscar", "Pablo", "Raúl", "Rubén", "Samuel", "Sergio", "Toni", "Víctor",
];
const APELLIDOS = [
  "Alonso", "Arranz", "Benito", "Blanco", "Calvo", "Castro", "Cuesta", "Díez", "Domínguez", "Esteban",
  "Fuentes", "Gallego", "Gil", "Herrero", "Iglesias", "Lorenzo", "Manso", "Martín", "Medina", "Merino",
  "Moreno", "Nieto", "Pascual", "Peña", "Prieto", "Ramos", "Rojo", "Sanz", "Tejedor", "Vallejo",
];

/** Nombre ficticio reproducible a partir del generador aleatorio. */
export function nombreAleatorio(rng: Rng): string {
  const n = NOMBRES[Math.floor(rng() * NOMBRES.length)];
  const a = APELLIDOS[Math.floor(rng() * APELLIDOS.length)];
  return `${n} ${a}`;
}

export function limitar(valor: number, min = 1, max = 100): number {
  return Math.max(min, Math.min(max, valor));
}

/** Media global 1-10 con un decimal a partir de atributos 1-100. */
export function mediaJugador(atributos: Atributos): number {
  const valores = Object.values(atributos).filter((v): v is number => typeof v === "number");
  if (valores.length === 0) return 0;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) / 10;
}

/** Genera un jugador cuya media ronda `nivel` (escala 1-10). */
export function generarJugador(
  rng: Rng,
  id: string,
  nombre: string,
  posicion: Posicion,
  nivel: number,
  dispersion = 7,
): JugadorPartido {
  const base = nivel * 10;
  const atributos: Atributos = {};
  if (posicion === "POR") {
    for (const k of ATRIBUTOS_PORTERO) atributos[k] = limitar(Math.round(gauss(rng, base, dispersion)));
  } else {
    const perfil = PERFIL[posicion];
    for (const k of ATRIBUTOS_CAMPO) {
      atributos[k] = limitar(Math.round(gauss(rng, base * (perfil[k] ?? 1), dispersion)));
    }
  }
  return { id, nombre, posicion, atributos };
}

/** Plantilla de prueba: 4-4-2 y cinco suplentes. Para calibración, tests y bots. */
export function generarEquipo(
  rng: Rng,
  id: string,
  nombre: string,
  nivel: number,
  formacion: [number, number, number] = [4, 4, 2],
): EquipoPartido {
  const [d, m, f] = formacion;
  const titulares: JugadorPartido[] = [generarJugador(rng, `${id}-POR`, nombreAleatorio(rng), "POR", nivel)];
  for (let i = 0; i < d; i++) titulares.push(generarJugador(rng, `${id}-D${i + 1}`, nombreAleatorio(rng), "DEF", nivel));
  for (let i = 0; i < m; i++) titulares.push(generarJugador(rng, `${id}-M${i + 1}`, nombreAleatorio(rng), "MED", nivel));
  for (let i = 0; i < f; i++) titulares.push(generarJugador(rng, `${id}-F${i + 1}`, nombreAleatorio(rng), "DEL", nivel));
  const posicionesBanquillo: Posicion[] = ["DEF", "MED", "MED", "DEL", "DEL"];
  const banquillo = posicionesBanquillo.map((pos, i) =>
    generarJugador(rng, `${id}-S${i + 1}`, nombreAleatorio(rng), pos, nivel - 0.3),
  );
  return {
    id,
    nombre,
    titulares,
    banquillo,
    tactica: { mentalidad: "equilibrada", presion: "normal" },
    familiaridad: 0.8,
    condicionales: [],
    segundoEntrenador: true,
  };
}
