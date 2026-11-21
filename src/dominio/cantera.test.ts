import { describe, expect, it } from "vitest";
import { crearRng, mediaJugador } from "@/motor";
import { costeObra, desarrollarJuvenil, estaListo, generarHornada, horasObra } from "./cantera";

describe("cantera", () => {
  it("el coste crece con el nivel y las obras no pasan de 48 horas", () => {
    expect(costeObra("escuela_cantera", 1)).toBe(300_000);
    expect(costeObra("escuela_cantera", 3)).toBe(900_000);
    for (let n = 1; n <= 5; n++) expect(horasObra(n)).toBeLessThanOrEqual(48);
  });

  it("la hornada respeta el tamaño por nivel y las edades de la academia", () => {
    for (let nivel = 1; nivel <= 5; nivel++) {
      for (let s = 1; s <= 20; s++) {
        const h = generarHornada(crearRng(s * 31 + nivel), { nivelEscuela: nivel, mediaEquipo: 4, popularidad: 50 });
        expect(h.length).toBeGreaterThanOrEqual(2);
        expect(h.length).toBeLessThanOrEqual(5);
        for (const j of h) {
          expect(j.edad).toBeGreaterThanOrEqual(15);
          expect(j.edad).toBeLessThanOrEqual(17);
          expect(j.potencial).toBeGreaterThanOrEqual(j.media * 10);
        }
      }
    }
  });

  it("una escuela mejor trae más joyas", () => {
    const joyas = (nivel: number) => {
      let n = 0;
      for (let s = 0; s < 400; s++) n += generarHornada(crearRng(s + 1000), { nivelEscuela: nivel, mediaEquipo: 4, popularidad: 50 }).filter((j) => j.joya).length;
      return n;
    };
    expect(joyas(5)).toBeGreaterThan(joyas(1) * 3);
  });

  it("los juveniles crecen hacia su potencial sin pasarse", () => {
    const j = generarHornada(crearRng(7), { nivelEscuela: 3, mediaEquipo: 4, popularidad: 50 })[0];
    let atributos = j.atributos;
    let media = j.media;
    for (let semana = 0; semana < 38; semana++) ({ atributos, media } = desarrollarJuvenil(atributos, j.potencial, 17, 3));
    expect(media).toBeGreaterThan(j.media);
    expect(media).toBeLessThanOrEqual(j.potencial / 10 + 0.1);
    expect(mediaJugador(atributos)).toBe(media);
  });

  it("está listo si se acerca a la media de la plantilla", () => {
    expect(estaListo(3.5, 4)).toBe(true);
    expect(estaListo(2.5, 4)).toBe(false);
  });
});
