import { describe, expect, it } from "vitest";
import { crearRng, generarEquipo, mediaJugador, SimuladorPartido, simularPartido, type EquipoPartido } from ".";

function equipos(semilla: number, nivelL = 5, nivelV = 5): [EquipoPartido, EquipoPartido] {
  const rng = crearRng(semilla);
  return [generarEquipo(rng, "L", "Local", nivelL), generarEquipo(rng, "V", "Visitante", nivelV)];
}

function serie(nivelL: number, nivelV: number, n: number) {
  const rng = crearRng(99);
  let v = 0, d = 0, goles = 0, golesFavorito = 0;
  let l = generarEquipo(rng, "L", "L", nivelL);
  let vi = generarEquipo(rng, "V", "V", nivelV);
  for (let i = 0; i < n; i++) {
    if (i % 50 === 0) {
      l = generarEquipo(rng, "L", "L", nivelL);
      vi = generarEquipo(rng, "V", "V", nivelV);
    }
    const r = simularPartido(l, vi, Math.floor(rng() * 2 ** 32));
    goles += r.goles[0] + r.goles[1];
    golesFavorito += r.goles[0];
    if (r.goles[0] > r.goles[1]) v++;
    if (r.goles[0] < r.goles[1]) d++;
  }
  return { victoriasLocal: v / n, derrotasLocal: d / n, golesPorPartido: goles / n, golesFavorito: golesFavorito / n };
}

describe("generador", () => {
  it("genera jugadores con la media pedida", () => {
    const [l] = equipos(1, 6.5);
    const medias = l.titulares.map((j) => mediaJugador(j.atributos));
    const media = medias.reduce((a, b) => a + b, 0) / medias.length;
    expect(media).toBeGreaterThan(5.8);
    expect(media).toBeLessThan(7.2);
  });

  it("mantiene los atributos entre 1 y 100", () => {
    const [l] = equipos(2, 9.8);
    for (const j of [...l.titulares, ...l.banquillo]) {
      for (const v of Object.values(j.atributos)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("partido", () => {
  it("es reproducible con la misma semilla", () => {
    const [l, v] = equipos(3);
    const a = simularPartido(l, v, 12345);
    const b = simularPartido(l, v, 12345);
    expect(a).toEqual(b);
  });

  it("dura 90 minutos y termina con evento final", () => {
    const [l, v] = equipos(4);
    const r = simularPartido(l, v, 1);
    expect(r.eventos.at(-1)?.tipo).toBe("final");
    expect(r.posesion[0] + r.posesion[1]).toBe(100);
  });

  it("no modifica los equipos originales", () => {
    const [l, v] = equipos(5);
    const titulares = l.titulares.map((j) => j.id).join();
    const sim = new SimuladorPartido(l, v, 7);
    sim.darOrden("local", { tipo: "cambio", saleId: l.titulares[5].id, entraId: l.banquillo[1].id });
    sim.simularCompleto();
    expect(l.titulares.map((j) => j.id).join()).toBe(titulares);
  });

  it("aplica una orden en directo y respeta el máximo de cinco cambios", () => {
    const [l, v] = equipos(6);
    l.segundoEntrenador = false;
    const sim = new SimuladorPartido(l, v, 8);
    for (let i = 0; i < 30; i++) sim.avanzarMinuto();
    for (let i = 0; i < 5; i++) {
      sim.darOrden("local", { tipo: "cambio", saleId: l.titulares[i + 1].id, entraId: l.banquillo[i].id });
    }
    sim.darOrden("local", { tipo: "tactica", mentalidad: "ofensiva" });
    const r = sim.simularCompleto();
    const cambios = r.eventos.filter((e) => e.tipo === "cambio" && e.lado === "local");
    expect(cambios.length).toBeLessThanOrEqual(5);
    expect(cambios.length).toBeGreaterThan(0);
    expect(r.eventos.some((e) => e.tipo === "tactica" && e.lado === "local")).toBe(true);
  });

  it("activa una instrucción condicional cuando se cumple", () => {
    const [l, v] = equipos(7);
    l.condicionales = [{ id: "c1", desdeMinuto: 1, marcador: "empatando", accion: { mentalidad: "defensiva" } }];
    const r = simularPartido(l, v, 9);
    expect(r.eventos.some((e) => e.tipo === "condicional" && e.lado === "local")).toBe(true);
    expect(r.eventos.filter((e) => e.tipo === "condicional").length).toBe(1);
  });
});

describe("calibración", () => {
  it("entre iguales da un número de goles realista y ventaja local", () => {
    const s = serie(5, 5, 1500);
    expect(s.golesPorPartido).toBeGreaterThan(2.3);
    expect(s.golesPorPartido).toBeLessThan(3.2);
    expect(s.victoriasLocal).toBeGreaterThan(s.derrotasLocal);
  });

  it("el mejor equipo gana más, sin humillar", () => {
    const s = serie(6, 5, 1500);
    expect(s.victoriasLocal).toBeGreaterThan(0.6);
    expect(s.victoriasLocal).toBeLessThan(0.85);
  });

  it("un gran desequilibrio no produce marcadores absurdos", () => {
    const s = serie(7, 4, 800);
    expect(s.golesFavorito).toBeLessThan(6);
  });
});
