/**
 * Generador aleatorio con semilla (mulberry32).
 *
 * Cada partido guarda su semilla: así se puede reproducir exactamente,
 * auditar resultados y depurar fallos.
 */
export type Rng = () => number;

export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número con distribución normal (Box-Muller). */
export function gauss(rng: Rng, media: number, desviacion: number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return media + desviacion * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function uniforme(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function semillaAleatoria(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
