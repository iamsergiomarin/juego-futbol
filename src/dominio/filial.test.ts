import { describe, expect, it } from "vitest";
import { crearRng } from "@/motor";
import { armarFilial, calendarioFilial, fechaDomingo, mediaFilialBot, type JugadorFilial } from "./filial";

const real = (id: string, posicion: JugadorFilial["posicion"], media: number): JugadorFilial => ({ id, nombre: id, posicion, atributos: { pase: media * 10, regate: media * 10 }, media });

describe("filial", () => {
  it("una vuelta de 19 jornadas en la que todos juegan una vez contra todos", () => {
    const clubes = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const c = calendarioFilial(clubes, crearRng(4));
    expect(c).toHaveLength(190);
    expect(Math.max(...c.map((e) => e.jornada))).toBe(19);
    const pares = new Set(c.map((e) => [e.local, e.visitante].sort().join("|")));
    expect(pares.size).toBe(190);
    for (let j = 1; j <= 19; j++) expect(c.filter((e) => e.jornada === j)).toHaveLength(10);
  });

  it("juega en domingo, una semana tras otra", () => {
    expect(fechaDomingo("2026-11-30", 1)).toBe("2026-12-06");
    expect(new Date(`${fechaDomingo("2026-11-30", 7)}T12:00:00Z`).getUTCDay()).toBe(0);
  });

  it("alinea un 4-4-2 completo con relleno y mete a los reales mejores", () => {
    const reales = [real("a", "DEL", 4), real("b", "DEL", 3), real("c", "DEL", 2), real("d", "POR", 3)];
    const { equipo, juegan, relleno } = armarFilial(crearRng(2), "club", "Club B", reales, 2);
    expect(equipo.titulares).toHaveLength(11);
    expect(equipo.banquillo).toHaveLength(5);
    expect(equipo.titulares.filter((j) => j.posicion === "DEL")).toHaveLength(2);
    expect(equipo.titulares.map((j) => j.id)).toEqual(expect.arrayContaining(["a", "b", "d"]));
    expect(juegan).toEqual(expect.arrayContaining(["a", "b", "c", "d"]));
    expect(relleno).toBeGreaterThan(0);
  });

  it("sin jugadores propios, todo es relleno y el filial de un bot queda por debajo de su primer equipo", () => {
    expect(armarFilial(crearRng(1), "x", "X B", [], 2).juegan).toHaveLength(0);
    for (let s = 0; s < 50; s++) expect(mediaFilialBot(4, crearRng(s))).toBeLessThan(4);
  });
});
