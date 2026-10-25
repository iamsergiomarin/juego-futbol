/**
 * Nombres ficticios para jugadores, personal y clubes bot.
 * Las localidades son inventadas para no coincidir con clubes reales.
 */
import type { Rng } from "@/motor";

export const NOMBRES = [
  "Adrián", "Álvaro", "Andrés", "Ángel", "Borja", "Carlos", "César", "Dani", "Darío", "David",
  "Diego", "Edu", "Enrique", "Fede", "Fran", "Gonzalo", "Guille", "Héctor", "Hugo", "Iker",
  "Iván", "Jaime", "Javi", "Jesús", "Jorge", "José", "Juanma", "Julen", "Lucas", "Luis",
  "Manu", "Marcos", "Mario", "Martín", "Miguel", "Nacho", "Nico", "Óscar", "Pablo", "Pedro",
  "Rafa", "Raúl", "Roberto", "Rodrigo", "Rubén", "Samuel", "Sergio", "Toni", "Unai", "Víctor",
];

export const APELLIDOS = [
  "Alonso", "Arranz", "Benito", "Blanco", "Bravo", "Calvo", "Campos", "Castro", "Cuesta", "Delgado",
  "Díez", "Domínguez", "Esteban", "Fuentes", "Gallego", "Garrido", "Gil", "Herrero", "Iglesias", "León",
  "Lorenzo", "Manso", "Marín", "Martín", "Medina", "Merino", "Mora", "Moreno", "Nieto", "Ortega",
  "Pascual", "Peña", "Prieto", "Ramos", "Redondo", "Rojo", "Rubio", "Sáez", "Sanz", "Santos",
  "Serrano", "Soto", "Tejedor", "Toledo", "Urbano", "Vallejo", "Vega", "Velasco", "Vicente", "Zamora",
];

const PREFIJOS_CLUB = ["CD", "UD", "CF", "SD", "Atlético", "Real", "Racing", "Deportivo", "Club", "Unión"];

const LOCALIDADES = [
  "Valdecastro", "Fuentesalada", "Navalcruz", "Torrealba", "Peñaclara", "Villarrosa", "Castrojuan",
  "Montealegre del Río", "Robledo Alto", "Vegaserrana", "Campollano", "Villaurea", "Nogalejo",
  "Aldeanueva del Cierzo", "Piedrabuena del Valle", "Sotoverde", "Quintanilla del Llano", "Encinar",
  "Riomayor", "Laguna Seca", "Castrillo de la Vega", "Valdemoro Bajo", "Pinarejo", "Torremocha del Campo",
  "Cerrogordo", "Matalobos", "Viñalba", "Hontanar", "Fresnedo", "Carrascal", "Pozuelo de la Sierra",
  "Valverdejo", "Almenara del Duero", "Rocabruna", "Majadahonda Baja", "Sierrafría",
];

export function elegir<T>(rng: Rng, lista: readonly T[]): T {
  return lista[Math.floor(rng() * lista.length)];
}

export function nombreJugador(rng: Rng): { nombre: string; apellido: string } {
  return { nombre: elegir(rng, NOMBRES), apellido: elegir(rng, APELLIDOS) };
}

/** Nombres de club bot únicos (y distintos de los ya usados). */
export function nombresClubes(rng: Rng, cantidad: number, usados: Set<string> = new Set()): { nombre: string; ciudad: string }[] {
  const resultado: { nombre: string; ciudad: string }[] = [];
  const ciudadesUsadas = new Set<string>();
  let intentos = 0;
  while (resultado.length < cantidad && intentos < 10_000) {
    intentos++;
    const ciudad = elegir(rng, LOCALIDADES);
    if (ciudadesUsadas.has(ciudad)) continue;
    const nombre = `${elegir(rng, PREFIJOS_CLUB)} ${ciudad}`;
    if (usados.has(nombre.toLowerCase())) continue;
    ciudadesUsadas.add(ciudad);
    usados.add(nombre.toLowerCase());
    resultado.push({ nombre, ciudad });
  }
  return resultado;
}

/** Colores de escudo para los bots: pares legibles. */
const PARES_COLORES: [string, string][] = [
  ["#b3261e", "#ffffff"], ["#1d4e89", "#ffffff"], ["#1f6b3a", "#ffffff"], ["#111111", "#ffffff"],
  ["#6a1b9a", "#ffffff"], ["#f2c230", "#1b1d1a"], ["#e65100", "#1b1d1a"], ["#0b7a75", "#ffffff"],
  ["#7a1f2b", "#f2c230"], ["#ffffff", "#1d4e89"], ["#ffffff", "#b3261e"], ["#3d5a80", "#ee6c4d"],
];

export function coloresBot(rng: Rng): [string, string] {
  return elegir(rng, PARES_COLORES);
}
