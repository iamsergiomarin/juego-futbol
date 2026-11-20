import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("La Grada en una partida local", () => {
  let clubId: string;
  let m: {
    grada: typeof import("./grada");
    liga: typeof import("./liga");
    mercado: typeof import("./mercado");
    bd: Awaited<ReturnType<typeof import("./bd").bdLocal>>;
  };

  beforeAll(async () => {
    const mundo = await import("./mundo");
    m = {
      grada: await import("./grada"),
      liga: await import("./liga"),
      mercado: await import("./mercado"),
      bd: await (await import("./bd")).bdLocal(),
    };
    clubId = await mundo.crearPartidaLocal(
      { nombreManager: "Sergio", nombreClub: "Real Valladolid", abreviatura: "RVA", ciudad: "Valladolid", colorPrincipal: "#8a1fd1", colorSecundario: "#ffffff" },
      33,
    );
    await m.liga.asegurarCalendario();
  }, 60_000);

  it("crea la grada del club con mánager, con su bienvenida, y solo la suya", async () => {
    await m.grada.asegurarGrada();
    await m.grada.asegurarGrada(); // idempotente
    const voces = await m.bd.query<{ n: number }>("select count(*)::int as n from voces_grada where club_id = $1", [clubId]);
    expect(voces.rows[0].n).toBe(9);
    const total = await m.bd.query<{ clubes: number }>("select count(distinct club_id)::int as clubes from voces_grada");
    expect(total.rows[0].clubes).toBe(1);
    const linea = await m.grada.lineaDeTiempo(m.bd, clubId);
    expect(linea.length).toBeGreaterThanOrEqual(5);
    expect(linea.some((p) => p.texto.includes("Sergio"))).toBe(true);
  });

  it("reacciona a un fichaje", async () => {
    const libres = await m.mercado.ofertasMercado(clubId, { tipo: "libres" });
    const nombre = await m.mercado.ficharJugador(clubId, libres[0].id, 2);
    const linea = await m.grada.lineaDeTiempo(m.bd, clubId);
    expect(linea.filter((p) => p.texto.includes(nombre)).length).toBeGreaterThanOrEqual(3);
    expect(linea[0].autorTipo).not.toBe("rival");
  });

  it("después de una jornada hay previa, resultado, hilos y el ánimo se mueve", async () => {
    const antes = (await m.grada.estadoGrada(m.bd, clubId)).animo;
    const antesPosts = (await m.grada.lineaDeTiempo(m.bd, clubId, "todo", 200)).length;
    await m.liga.jugarSiguienteJornada();
    const linea = await m.grada.lineaDeTiempo(m.bd, clubId, "todo", 200);
    expect(linea.length - antesPosts).toBeGreaterThanOrEqual(10);
    expect(linea.some((p) => p.texto.startsWith("PREVIA"))).toBe(true);
    const oficial = linea.find((p) => p.autorTipo === "club" && p.respuestas.some((r) => r.autorTipo === "rival"));
    expect(oficial).toBeTruthy();
    expect(oficial!.respuestas.length).toBeGreaterThanOrEqual(1);
    expect(oficial!.respuestas[0].autorTipo).toBe("rival");
    expect(oficial!.respuestas[0].respuestas.length).toBeGreaterThanOrEqual(1);
    const despues = (await m.grada.estadoGrada(m.bd, clubId)).animo;
    expect(despues).not.toBe(antes);
    expect(oficial!.meGusta).toBeGreaterThan(0);
  });

  it("filtra por tipo de cuenta", async () => {
    const prensa = await m.grada.lineaDeTiempo(m.bd, clubId, "prensa", 100);
    expect(prensa.length).toBeGreaterThan(0);
    expect(prensa.every((p) => p.autorTipo === "prensa")).toBe(true);
    const aficion = await m.grada.lineaDeTiempo(m.bd, clubId, "aficion", 100);
    expect(aficion.every((p) => ["aficion", "pena", "rival"].includes(p.autorTipo))).toBe(true);
  });

  it("una temporada entera mantiene textos limpios, el ánimo acotado y el ambiente legible", async () => {
    await m.liga.jugarJornadas(100);
    const todo = await m.bd.query<{ texto: string; autor_usuario: string; me_gusta: number }>("select texto, autor_usuario, me_gusta from publicaciones where club_id = $1", [clubId]);
    expect(todo.rows.length).toBeGreaterThan(300);
    for (const r of todo.rows) {
      expect(r.texto).not.toMatch(/[{}]/);
      expect(r.texto).not.toMatch(/undefined|NaN/);
      expect(r.autor_usuario).toMatch(/^@/);
      expect(r.me_gusta).toBeGreaterThanOrEqual(0);
    }
    const estado = await m.grada.estadoGrada(m.bd, clubId);
    expect(estado.animo).toBeGreaterThanOrEqual(0);
    expect(estado.animo).toBeLessThanOrEqual(100);
    expect(estado.voces).toHaveLength(9);
    expect(estado.masComentadas.length).toBe(3);
    expect(estado.etiquetas[0]).toMatch(/^#/);
    // Los hitos (campeón, playoff, ascenso) dependen del azar de la temporada: solo se exigen si el club los vivió.
    const pos = (await m.bd.query<{ p: number }>(
      `select (select count(*) + 1 from clasificacion o where o.temporada_id = k.temporada_id and o.grupo_id = k.grupo_id
                 and (o.puntos, o.goles_favor - o.goles_contra, o.goles_favor) > (k.puntos, k.goles_favor - k.goles_contra, k.goles_favor))::int as p
         from clasificacion k where k.club_id = $1 and k.temporada_id = (select id from temporadas where actual)`,
      [clubId],
    )).rows[0].p;
    if (pos <= 5) expect(todo.rows.some((r) => /playoff|CAMPEONES/i.test(r.texto))).toBe(true);
  }, 120_000);
});
