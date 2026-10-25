import { describe, expect, it } from "vitest";
import { crearRng } from "@/motor";
import { calendarioDobleVuelta, fechaJornada } from "./calendario";

const equipos = Array.from({ length: 20 }, (_, i) => `E${i + 1}`);

describe("calendario de liga", () => {
  const cal = calendarioDobleVuelta(equipos, crearRng(1));

  it("tiene 38 jornadas de 10 partidos", () => {
    expect(cal).toHaveLength(380);
    for (let j = 1; j <= 38; j++) expect(cal.filter((e) => e.jornada === j)).toHaveLength(10);
  });

  it("nadie juega dos veces en la misma jornada", () => {
    for (let j = 1; j <= 38; j++) {
      const delDia = cal.filter((e) => e.jornada === j).flatMap((e) => [e.local, e.visitante]);
      expect(new Set(delDia).size).toBe(20);
    }
  });

  it("cada pareja se enfrenta dos veces, una en cada campo", () => {
    for (const a of equipos) {
      for (const b of equipos) {
        if (a === b) continue;
        expect(cal.filter((e) => e.local === a && e.visitante === b)).toHaveLength(1);
      }
    }
  });

  it("cada equipo juega 19 partidos en casa", () => {
    for (const e of equipos) expect(cal.filter((p) => p.local === e)).toHaveLength(19);
  });

  it("nadie encadena más de dos partidos seguidos en el mismo campo en la primera vuelta", () => {
    for (const e of equipos) {
      let racha = 0;
      let anterior: boolean | null = null;
      for (let j = 1; j <= 19; j++) {
        const p = cal.find((x) => x.jornada === j && (x.local === e || x.visitante === e))!;
        const enCasa = p.local === e;
        racha = enCasa === anterior ? racha + 1 : 1;
        anterior = enCasa;
        expect(racha).toBeLessThanOrEqual(3);
      }
    }
  });

  it("pone las jornadas impares en lunes y las pares en sábado", () => {
    expect(fechaJornada("2026-10-26", 1)).toBe("2026-10-26");
    expect(fechaJornada("2026-10-26", 2)).toBe("2026-10-31");
    expect(fechaJornada("2026-10-26", 3)).toBe("2026-11-02");
    expect(new Date(`${fechaJornada("2026-10-26", 38)}T12:00:00Z`).getUTCDay()).toBe(6);
  });
});
