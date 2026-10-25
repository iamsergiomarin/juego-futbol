import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("gestión deportiva en una partida local", () => {
  let clubId: string;
  let m: {
    liga: typeof import("./liga");
    consultas: typeof import("./consultas");
    plantilla: typeof import("./plantilla");
    mercado: typeof import("./mercado");
    temporada: typeof import("./temporada");
    bd: Awaited<ReturnType<typeof import("./bd").bdLocal>>;
    tactica: typeof import("@/dominio/tactica");
  };

  beforeAll(async () => {
    const mundo = await import("./mundo");
    m = {
      liga: await import("./liga"),
      consultas: await import("./consultas"),
      plantilla: await import("./plantilla"),
      mercado: await import("./mercado"),
      temporada: await import("./temporada"),
      bd: await (await import("./bd")).bdLocal(),
      tactica: await import("@/dominio/tactica"),
    };
    clubId = await mundo.crearPartidaLocal(
      { nombreManager: "Sergio", nombreClub: "Real Valladolid", abreviatura: "RVA", ciudad: "Valladolid", colorPrincipal: "#8a1fd1", colorSecundario: "#ffffff" },
      21,
    );
  }, 60_000);

  it("guarda un planteamiento propio y rechaza uno inválido", async () => {
    const js = await m.plantilla.jugadoresEstado(m.bd, clubId);
    const { once, banquillo } = m.tactica.alineacionAutomatica(m.plantilla.alineables(js), "4-3-3");
    await m.plantilla.guardarPlanteamiento(clubId, { formacion: "4-3-3", once, banquillo, mentalidad: "ofensiva", presion: "alta", condicionales: [] });
    expect((await m.plantilla.planteamientoClub(m.bd, clubId)).formacion).toBe("4-3-3");
    await expect(
      m.plantilla.guardarPlanteamiento(clubId, { formacion: "4-4-2", once: once.slice(0, 10), banquillo, mentalidad: "equilibrada", presion: "normal", condicionales: [] }),
    ).rejects.toThrow("Falta completar el once");
  });

  it("el partido usa el planteamiento guardado", async () => {
    const { equipo } = await m.plantilla.equipoParaPartido(m.bd, clubId);
    expect(equipo.titulares.filter((j) => j.posicion === "DEL")).toHaveLength(3);
    expect(equipo.tactica).toEqual({ mentalidad: "ofensiva", presion: "alta" });
  });

  it("ficha un agente libre en pretemporada y no permite traspasos con la ventana cerrada", async () => {
    const libres = await m.mercado.ofertasMercado(clubId, { tipo: "libres" });
    expect(libres.length).toBeGreaterThan(10);
    const cajaAntes = (await m.mercado.estadoMercado(clubId)).caja;
    await m.mercado.ficharJugador(clubId, libres[0].id, 2);
    expect((await m.plantilla.jugadoresEstado(m.bd, clubId)).some((j) => j.id === libres[0].id)).toBe(true);
    expect((await m.mercado.estadoMercado(clubId)).caja).toBeLessThan(cajaAntes);

    await m.liga.jugarJornadas(3);
    const transferibles = await m.mercado.ofertasMercado(clubId, { tipo: "transferibles" });
    if (transferibles.length > 0) {
      await expect(m.mercado.ficharJugador(clubId, transferibles[0].id, 1)).rejects.toThrow("ventana de traspasos está cerrada");
    }
  }, 60_000);

  it("entrena, cansa y recupera a los jugadores entre jornadas", async () => {
    const js = await m.plantilla.jugadoresEstado(m.bd, clubId);
    expect(js.some((j) => j.cansancio > 0 || j.forma !== 50)).toBe(true);
    const noticias = await m.bd.query<{ n: number }>("select count(*)::int as n from noticias where club_id = $1 and tipo = 'entrenamiento'", [clubId]);
    expect(noticias.rows[0].n).toBeGreaterThan(0);
  });

  it("renueva contratos con lo que pide el jugador", async () => {
    const [j] = await m.plantilla.jugadoresEstado(m.bd, clubId);
    const hasta = await m.mercado.renovarContrato(clubId, j.id, 3);
    expect(hasta).toBeGreaterThanOrEqual(4);
  });

  it("termina la liga, juega el playoff y asciende al campeón a Cuarta con rivales nuevos", async () => {
    await m.liga.jugarJornadas(100);
    const r = (await m.temporada.resumenTemporada(clubId))!;
    expect(r.fase).toBe("terminada");
    expect(r.playoff.map((p) => p.ronda)).toEqual(["Semifinal", "Semifinal", "Final", "Cruce de ascenso"]);
    expect(r.playoff.every((p) => p.ganador)).toBe(true);

    // Forzamos el campeonato para probar el ascenso.
    await m.bd.query("update clasificacion set puntos = 200 where club_id = $1", [clubId]);
    expect((await m.temporada.resumenTemporada(clubId))!.desenlace).toBe("campeon");
    const numero = await m.temporada.nuevaTemporada(clubId);
    expect(numero).toBe(2);
    const cab = (await m.consultas.cabeceraClub(clubId))!;
    expect(cab.division).toBe("Cuarta");
    const tabla = await m.consultas.clasificacion(cab.grupoId);
    expect(tabla).toHaveLength(20);
    expect(tabla.every((f) => f.jugados === 0)).toBe(true);
    expect(await m.consultas.partidosClub(clubId, "pendientes", 50)).toHaveLength(38);
    const eco = await m.consultas.resumenEconomia(clubId);
    expect(eco.porConcepto.some((c) => c.concepto === "Prima de ascenso" && c.importe > 0)).toBe(true);
    await expect(m.temporada.nuevaTemporada(clubId)).rejects.toThrow("todavía no ha terminado");
  }, 180_000);
});
