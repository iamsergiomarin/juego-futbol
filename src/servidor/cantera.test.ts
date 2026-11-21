import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("Obras y cantera en una partida local", () => {
  let clubId: string;
  let m: {
    inst: typeof import("./instalaciones");
    cantera: typeof import("./cantera");
    liga: typeof import("./liga");
    temporada: typeof import("./temporada");
    bd: Awaited<ReturnType<typeof import("./bd").bdLocal>>;
  };

  beforeAll(async () => {
    const mundo = await import("./mundo");
    m = {
      inst: await import("./instalaciones"),
      cantera: await import("./cantera"),
      liga: await import("./liga"),
      temporada: await import("./temporada"),
      bd: await (await import("./bd")).bdLocal(),
    };
    clubId = await mundo.crearPartidaLocal(
      { nombreManager: "Sergio", nombreClub: "Real Valladolid", abreviatura: "RVA", ciudad: "Valladolid", colorPrincipal: "#8a1fd1", colorSecundario: "#ffffff" },
      52,
    );
    await m.liga.asegurarCalendario();
    await (await import("./grada")).asegurarGrada();
  }, 60_000);

  it("sin escuela no hay juveniles", async () => {
    const r = await m.cantera.juvenilesDelClub(clubId);
    expect(r.nivel).toBe(0);
    expect(r.juveniles).toHaveLength(0);
  });

  it("construir la escuela cobra la obra, no se puede duplicar y se inaugura con la jornada", async () => {
    const antes = (await m.bd.query<{ d: number }>("select dinero::float8 as d from clubes where id = $1", [clubId])).rows[0].d;
    await m.inst.iniciarObra(clubId, "escuela_cantera");
    const despues = (await m.bd.query<{ d: number }>("select dinero::float8 as d from clubes where id = $1", [clubId])).rows[0].d;
    expect(antes - despues).toBe(300_000);
    await expect(m.inst.iniciarObra(clubId, "escuela_cantera")).rejects.toThrow(/en marcha/);
    await m.liga.jugarJornadas(1);
    const e = (await m.inst.edificiosConObras(clubId)).find((x) => x.tipo === "escuela_cantera")!;
    expect(e.nivel).toBe(1);
    expect(e.obra).toBeNull();
  });

  it("al inaugurarla llega la primera hornada, que crece con las semanas", async () => {
    const r = await m.cantera.juvenilesDelClub(clubId);
    expect(r.nivel).toBe(1);
    expect(r.juveniles).toHaveLength(2);
    const antes = r.juveniles.map((j) => j.media);
    await m.liga.jugarJornadas(4);
    const despues = (await m.cantera.juvenilesDelClub(clubId)).juveniles.map((j) => j.media).sort();
    expect(despues.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(antes.reduce((a, b) => a + b, 0));
  });

  it("dar contrato a un juvenil lo pasa al primer equipo como canterano", async () => {
    const { juveniles } = await m.cantera.juvenilesDelClub(clubId);
    const nombre = await m.cantera.subirJuvenil(clubId, juveniles[0].id);
    const j = await m.bd.query<{ formador: string; ficha: string }>("select club_formador as formador, ficha from jugadores where club_id = $1 and nombre || ' ' || apellido = $2", [clubId, nombre]);
    expect(j.rows[0].formador).toBe(clubId);
    expect(j.rows[0].ficha).toBe("primer_equipo");
    expect((await m.cantera.juvenilesDelClub(clubId)).juveniles).toHaveLength(1);
    await expect(m.cantera.subirJuvenil(clubId, juveniles[0].id)).rejects.toThrow();
    const g = await m.bd.query<{ n: number }>("select count(*)::int as n from publicaciones where club_id = $1 and texto like '%DE LA CASA%'", [clubId]);
    expect(g.rows[0].n).toBeGreaterThan(0);
  });

  it("a mitad de curso llega la segunda hornada, y el centro médico y el estadio mejoran con obras", async () => {
    await m.liga.jugarJornadas(20);
    const hornadas = await m.bd.query<{ h: string }>("select distinct hornada as h from juveniles where club_id = $1", [clubId]);
    expect(hornadas.rows.map((r) => r.h).sort()).toEqual(["inauguracion", "mitad"]);
    const aforoAntes = (await m.bd.query<{ a: number }>("select sum(aforo)::int as a from sectores_estadio where club_id = $1", [clubId])).rows[0].a;
    await m.bd.query("update clubes set dinero = dinero + 1000000 where id = $1", [clubId]);
    await m.inst.iniciarObra(clubId, "estadio");
    await m.liga.jugarJornadas(1);
    const aforoDespues = (await m.bd.query<{ a: number }>("select sum(aforo)::int as a from sectores_estadio where club_id = $1", [clubId])).rows[0].a;
    expect(aforoDespues - aforoAntes).toBe(1000);
  });
});
