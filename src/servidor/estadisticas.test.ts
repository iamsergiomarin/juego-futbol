import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("Estadísticas de la competición", () => {
  let clubId: string;
  let c: typeof import("./consultas");
  let bd: Awaited<ReturnType<typeof import("./bd").bdLocal>>;

  beforeAll(async () => {
    const mundo = await import("./mundo");
    const liga = await import("./liga");
    c = await import("./consultas");
    bd = await (await import("./bd")).bdLocal();
    clubId = await mundo.crearPartidaLocal(
      { nombreManager: "Sergio", nombreClub: "Real Valladolid", abreviatura: "RVA", ciudad: "Valladolid", colorPrincipal: "#8a1fd1", colorSecundario: "#ffffff" },
      63,
    );
    await liga.asegurarCalendario();
    await liga.jugarJornadas(6);
  }, 60_000);

  it("los goleadores salen ordenados y no superan los goles del grupo", async () => {
    const g = await c.goleadoresGrupo(clubId, 50);
    expect(g.length).toBeGreaterThan(0);
    for (let i = 1; i < g.length; i++) expect(g[i - 1].goles).toBeGreaterThanOrEqual(g[i].goles);
    const total = (await bd.query<{ n: number }>("select coalesce(sum(goles_favor), 0)::int as n from clasificacion where temporada_id = (select id from temporadas where actual) and grupo_id = (select grupo_id from clubes where id = $1)", [clubId])).rows[0].n;
    expect(g.reduce((a, x) => a + x.goles, 0)).toBeLessThanOrEqual(total);
  });

  it("los equipos del grupo suman sus partidos", async () => {
    const e = await c.equiposGrupo(clubId);
    expect(e).toHaveLength(20);
    expect(e.every((x) => x.jugados === 6)).toBe(true);
    expect(e.filter((x) => x.propio)).toHaveLength(1);
  });
});

describe("Pendiente en el club", () => {
  it("avisa de las ofertas de patrocinio sin responder", async () => {
    const c = await import("./consultas");
    const p = await import("./patrocinio");
    const mundo = await import("./mundo");
    void mundo;
    const bd = await (await import("./bd")).bdLocal();
    const club = (await bd.query<{ id: string }>("select id from clubes where manager_id is not null")).rows[0].id;
    await p.ofertasPendientes(club);
    const lista = await c.pendientesDelClub(club);
    expect(lista.some((x) => x.enlace === "/club/patrocinio")).toBe(true);
  });
});
