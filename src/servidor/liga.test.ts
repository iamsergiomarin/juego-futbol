import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("temporada de liga completa", () => {
  let clubId: string;
  let liga: typeof import("./liga");
  let consultas: typeof import("./consultas");

  beforeAll(async () => {
    const mundo = await import("./mundo");
    liga = await import("./liga");
    consultas = await import("./consultas");
    clubId = await mundo.crearPartidaLocal(
      {
        nombreManager: "Sergio",
        nombreClub: "Atlético Pisuerga",
        abreviatura: "ATP",
        ciudad: "Valladolid",
        colorPrincipal: "#5b2a86",
        colorSecundario: "#ffffff",
      },
      7,
    );
  }, 60_000);

  it("crea el calendario al fundar el club", async () => {
    const e = await consultas.estadoTemporada();
    expect(e).toMatchObject({ numero: 1, jugadas: 0, total: 38 });
    expect(await consultas.partidosClub(clubId, "pendientes", 50)).toHaveLength(38);
  });

  it("juega la primera jornada y actualiza la clasificación", async () => {
    const r = await liga.jugarSiguienteJornada();
    expect(r).toMatchObject({ jornada: 1, partidos: 10, terminada: false });
    const cab = (await consultas.cabeceraClub(clubId))!;
    const tabla = await consultas.clasificacion(cab.grupoId);
    expect(tabla.every((f) => f.jugados === 1)).toBe(true);
    const puntos = tabla.reduce((a, f) => a + f.puntos, 0);
    const empates = tabla.filter((f) => f.empatados === 1).length / 2;
    expect(puntos).toBe(10 * 3 - empates);
  });

  it("no crea un segundo calendario", async () => {
    await liga.asegurarCalendario();
    expect((await consultas.partidosClub(clubId, "jugados", 50)).length + (await consultas.partidosClub(clubId, "pendientes", 50)).length).toBe(38);
  });

  it("guarda la ficha del partido con alineaciones y eventos", async () => {
    const [p] = await consultas.partidosClub(clubId, "jugados", 1);
    const d = (await consultas.detallePartido(p.id))!;
    expect(d.estado).toBe("finalizado");
    expect(d.alineaciones.local.titulares).toHaveLength(11);
    expect(d.alineaciones.visitante.titulares).toHaveLength(11);
    expect(d.eventos.at(-1)?.tipo).toBe("final");
    expect(d.asistencia).toBeGreaterThan(0);
  });

  it("completa la temporada con 38 partidos por equipo y una economía que no se hunde", async () => {
    await liga.jugarJornadas(100);
    const e = (await consultas.estadoTemporada())!;
    expect(e.jugadas).toBe(38);
    expect(await liga.jugarSiguienteJornada()).toMatchObject({ partidos: 0, terminada: true });

    const cab = (await consultas.cabeceraClub(clubId))!;
    const tabla = await consultas.clasificacion(cab.grupoId);
    expect(tabla.every((f) => f.jugados === 38)).toBe(true);
    expect(tabla.reduce((a, f) => a + f.golesFavor, 0)).toBe(tabla.reduce((a, f) => a + f.golesContra, 0));
    const golesPorPartido = tabla.reduce((a, f) => a + f.golesFavor, 0) / 380;
    expect(golesPorPartido).toBeGreaterThan(2);
    expect(golesPorPartido).toBeLessThan(3.6);

    const eco = await consultas.resumenEconomia(clubId);
    expect(eco.porConcepto.map((c) => c.concepto)).toEqual(expect.arrayContaining(["Taquilla", "Salarios de la plantilla", "Derechos de televisión"]));
    // Con la economía provisional, el club no debería acabar en números rojos en su primera temporada.
    expect(eco.caja).toBeGreaterThan(0);

    const stats = await consultas.estadisticasPlantilla(clubId);
    const total = [...stats.values()].reduce((a, s) => a + s.goles, 0);
    expect(total).toBe(tabla.find((f) => f.id === clubId)!.golesFavor);
  }, 120_000);
});
