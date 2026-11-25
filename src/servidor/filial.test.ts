import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("Filial en una partida local", () => {
  let club: string;
  let m: {
    f: typeof import("./filial");
    c: typeof import("./cantera");
    inst: typeof import("./instalaciones");
    liga: typeof import("./liga");
    cons: typeof import("./consultas");
    bd: Awaited<ReturnType<typeof import("./bd").bdLocal>>;
  };

  beforeAll(async () => {
    const mundo = await import("./mundo");
    m = {
      f: await import("./filial"),
      c: await import("./cantera"),
      inst: await import("./instalaciones"),
      liga: await import("./liga"),
      cons: await import("./consultas"),
      bd: await (await import("./bd")).bdLocal(),
    };
    club = await mundo.crearPartidaLocal(
      { nombreManager: "Sergio", nombreClub: "Real Valladolid", abreviatura: "RVA", ciudad: "Valladolid", colorPrincipal: "#8a1fd1", colorSecundario: "#ffffff" },
      88,
    );
    await m.liga.asegurarCalendario();
    await (await import("./grada")).asegurarGrada();
    await m.inst.iniciarObra(club, "escuela_cantera");
    await m.liga.jugarJornadas(1); // inaugura la escuela y llega la primera hornada
  }, 90_000);

  it("el calendario de filiales tiene 190 partidos, 19 jornadas", async () => {
    const r = await m.bd.query<{ n: number; j: number }>("select count(*)::int as n, max(jornada)::int as j from partidos_filial");
    expect(r.rows[0]).toEqual({ n: 190, j: 19 });
  });

  it("a los 16 años pasa al filial; antes no", async () => {
    const { juveniles } = await m.c.juvenilesDelClub(club);
    const j = juveniles[0];
    await m.bd.query("update juveniles set fecha_nacimiento = (select inicio from temporadas where actual) - interval '15 years 3 months' where id = $1", [j.id]);
    await expect(m.f.pasarAlFilial(club, j.id)).rejects.toThrow(/16 años/);
    await m.bd.query("update juveniles set fecha_nacimiento = (select inicio from temporadas where actual) - interval '17 years 3 months' where id = $1", [j.id]);
    await m.f.pasarAlFilial(club, j.id);
    expect((await m.f.datosFilial(club)).plantilla).toHaveLength(1);
  });

  it("el domingo de la semana 1 se juega la primera jornada de filiales y el juvenil se desarrolla jugando", async () => {
    await m.liga.jugarJornadas(1); // jornada 2: cierre de semana
    const jugados = await m.bd.query<{ n: number }>("select count(*)::int as n from partidos_filial where estado = 'finalizado' and jornada = 1");
    expect(jugados.rows[0].n).toBe(10);
    const d = await m.f.datosFilial(club);
    expect(d.tabla.reduce((a, f) => a + f.jugados, 0)).toBe(20);
    expect(d.tabla.reduce((a, f) => a + f.puntos, 0)).toBeGreaterThanOrEqual(20);
    expect(d.plantilla[0].partidos).toBeGreaterThanOrEqual(1);
    const noticia = await m.bd.query<{ n: number }>("select count(*)::int as n from noticias where club_id = $1 and titulo like 'Informe del analista: filial%'", [club]);
    expect(noticia.rows[0].n).toBe(1);
  });

  it("un menor de 22 sube al primer equipo sin ocupar ficha; no hay duplicados", async () => {
    const antes = (await m.f.datosFilial(club)).fichasPrimerEquipo;
    const [j] = (await m.f.datosFilial(club)).plantilla;
    await m.c.subirJuvenil(club, j.id, true);
    const d = await m.f.datosFilial(club);
    expect(d.fichasPrimerEquipo).toBe(antes);
    expect(d.sinFicha).toHaveLength(1);
    expect(d.plantilla).toHaveLength(0);
    await expect(m.c.subirJuvenil(club, j.id, true)).rejects.toThrow();
  });

  it("arriba cuenta partidos, y al cerrar la temporada recibe ficha si hay hueco o se marcha si no", async () => {
    await m.liga.jugarJornadas(2);
    const id = (await m.f.datosFilial(club)).sinFicha[0].id;
    await m.bd.query("update jugadores set partidos_primer_equipo_temporada = 12 where id = $1", [id]);
    expect((await m.cons.pendientesDelClub(club)).some((p) => p.enlace === "/equipo/filial")).toBe(true);
    await m.bd.transaction((tx) => m.f.cerrarFichasFilial(tx, club, { id: 1 }));
    const j = (await m.bd.query<{ ficha: string; club: string | null; partidos: number }>("select ficha, club_id as club, partidos_primer_equipo_temporada as partidos from jugadores where id = $1", [id])).rows[0];
    expect(j.ficha).toBe("primer_equipo");
    expect(j.club).toBe(club);
    expect(j.partidos).toBe(0);
  });

  it("sin hueco en la plantilla, quien pide ficha queda libre", async () => {
    const mundo = await m.bd.query<{ id: string }>("select id from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado limit 1", [club]);
    const id = mundo.rows[0].id;
    await m.bd.query("update jugadores set ficha = 'filial', partidos_primer_equipo_temporada = 11 where id = $1", [id]);
    // Llenamos la plantilla hasta el tope con fichas de relleno.
    const n = (await m.bd.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and ficha = 'primer_equipo' and not retirado", [club])).rows[0].n;
    expect(n).toBeLessThanOrEqual(25);
    await m.bd.query(
      `insert into jugadores (club_id, nombre, apellido, fecha_nacimiento, posicion, atributos, media, potencial)
       select $1, 'Relleno', 'N' || g, date '2000-01-01', 'DEF', '{}'::jsonb, 3, 50 from generate_series(1, $2) g`, [club, 25 - n + 1],
    );
    await m.bd.transaction((tx) => m.f.cerrarFichasFilial(tx, club, { id: 1 }));
    const r = (await m.bd.query<{ club: string | null }>("select club_id as club from jugadores where id = $1", [id])).rows[0];
    expect(r.club).toBeNull();
  });
});
