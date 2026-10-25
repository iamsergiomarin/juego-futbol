/**
 * Calendario de liga a doble vuelta (método del círculo).
 * Cada equipo juega contra todos dos veces, una en casa y otra fuera,
 * y la segunda vuelta repite la primera con los campos invertidos.
 */
import type { Rng } from "@/motor";

export interface Emparejamiento {
  jornada: number;
  local: string;
  visitante: string;
}

export function calendarioDobleVuelta(equipos: string[], rng?: Rng): Emparejamiento[] {
  if (equipos.length % 2 !== 0) throw new Error("El calendario necesita un número par de equipos.");
  const lista = [...equipos];
  if (rng) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
  }
  const n = lista.length;
  const rondas = n - 1;
  const ida: Emparejamiento[] = [];
  let rueda = [...lista];
  for (let r = 0; r < rondas; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = rueda[i];
      const b = rueda[n - 1 - i];
      // Alternancia de campo para que nadie encadene demasiados partidos seguidos en casa o fuera.
      const casaA = i === 0 ? r % 2 === 0 : i % 2 === 1;
      ida.push({ jornada: r + 1, local: casaA ? a : b, visitante: casaA ? b : a });
    }
    // El primero queda fijo; el resto gira una posición.
    rueda = [rueda[0], rueda[n - 1], ...rueda.slice(1, n - 1)];
  }
  const vuelta = ida.map((e) => ({ jornada: e.jornada + rondas, local: e.visitante, visitante: e.local }));
  return [...ida, ...vuelta];
}

/** Fecha (AAAA-MM-DD) de una jornada: impares en lunes, pares en sábado, dos por semana. */
export function fechaJornada(inicioTemporada: string, jornada: number): string {
  const d = new Date(`${inicioTemporada}T12:00:00Z`);
  const semana = Math.floor((jornada - 1) / 2);
  d.setUTCDate(d.getUTCDate() + semana * 7 + (jornada % 2 === 1 ? 0 : 5));
  return d.toISOString().slice(0, 10);
}
