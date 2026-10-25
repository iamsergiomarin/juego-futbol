import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

const DATOS = {
  nombreManager: "Sergio",
  nombreClub: "Atlético Pisuerga",
  abreviatura: "ATP",
  ciudad: "Valladolid",
  colorPrincipal: "#5b2a86",
  colorSecundario: "#ffffff",
};

describe("crear partida local", () => {
  let clubId: string;
  let mundo: typeof import("./mundo");
  let consultas: typeof import("./consultas");

  beforeAll(async () => {
    mundo = await import("./mundo");
    consultas = await import("./consultas");
    clubId = await mundo.crearPartidaLocal(DATOS, 42);
  }, 60_000);

  it("rechaza datos no válidos", () => {
    const e = mundo.validarClub({ ...DATOS, abreviatura: "A1", colorSecundario: "#5B2A86", nombreClub: "X" });
    expect(e.abreviatura).toBeDefined();
    expect(e.colorSecundario).toBeDefined();
    expect(e.nombreClub).toBeDefined();
    expect(Object.keys(mundo.validarClub(DATOS))).toHaveLength(0);
  });

  it("asocia el club al mánager local", async () => {
    const m = await consultas.managerLocal();
    expect(m?.nombre).toBe("Sergio");
    expect(m?.clubId).toBe(clubId);
  });

  it("crea el club en el grupo 1 de Quinta con su punto de partida", async () => {
    const f = await consultas.fichaClub(clubId);
    expect(f).not.toBeNull();
    expect(f!.nombre).toBe("Atlético Pisuerga");
    expect(f!.division).toBe("Quinta");
    expect(f!.grupo).toBe(1);
    expect(f!.dinero).toBe(500_000);
    expect(f!.aforo).toBe(2000);
    expect(f!.personal.map((p) => p.puesto)).toEqual(["segundo_entrenador", "preparador_fisico", "ojeador"]);
    expect(f!.edificios.find((e) => e.tipo === "sede")?.areas.map((a) => a.tipo)).toEqual(["direccion_deportiva", "oficina_ojeadores"]);
  });

  it("genera una plantilla de 22 con dorsales únicos y media de Quinta", async () => {
    const f = (await consultas.fichaClub(clubId))!;
    expect(f.plantilla).toHaveLength(22);
    expect(f.plantilla.filter((j) => j.posicion === "POR")).toHaveLength(3);
    expect(new Set(f.plantilla.map((j) => j.dorsal)).size).toBe(22);
    const media = f.plantilla.reduce((a, j) => a + j.media, 0) / 22;
    expect(media).toBeGreaterThan(3);
    expect(media).toBeLessThan(4.1);
    for (const j of f.plantilla) {
      expect(j.edad).toBeGreaterThanOrEqual(17);
      expect(j.edad).toBeLessThanOrEqual(36);
      expect(j.salario).toBeGreaterThan(0);
    }
  });

  it("rellena el grupo con 19 rivales bot algo por debajo", async () => {
    const f = (await consultas.fichaClub(clubId))!;
    expect(f.rivales).toHaveLength(19);
    expect(new Set(f.rivales.map((r) => r.nombre)).size).toBe(19);
    const mediaRivales = f.rivales.reduce((a, r) => a + r.media, 0) / 19;
    const mediaPropia = f.plantilla.reduce((a, j) => a + j.media, 0) / 22;
    expect(mediaRivales).toBeLessThan(mediaPropia);
  });

  it("no permite crear una segunda partida", async () => {
    await expect(mundo.crearPartidaLocal(DATOS, 7)).rejects.toThrow("Ya existe una partida");
  });
});
