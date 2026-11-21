import { beforeAll, describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("Patrocinio en una partida local", () => {
  let clubId: string;
  let m: {
    p: typeof import("./patrocinio");
    liga: typeof import("./liga");
    temporada: typeof import("./temporada");
    bd: Awaited<ReturnType<typeof import("./bd").bdLocal>>;
  };

  beforeAll(async () => {
    const mundo = await import("./mundo");
    m = { p: await import("./patrocinio"), liga: await import("./liga"), temporada: await import("./temporada"), bd: await (await import("./bd")).bdLocal() };
    clubId = await mundo.crearPartidaLocal(
      { nombreManager: "Sergio", nombreClub: "Real Valladolid", abreviatura: "RVA", ciudad: "Valladolid", colorPrincipal: "#8a1fd1", colorSecundario: "#ffffff" },
      41,
    );
    await m.liga.asegurarCalendario();
    await (await import("./grada")).asegurarGrada();
  }, 60_000);

  it("llegan ofertas para los dos espacios, sin duplicarse al recargar", async () => {
    const a = await m.p.ofertasPendientes(clubId);
    const b = await m.p.ofertasPendientes(clubId);
    expect(a.length).toBe(b.length);
    expect(new Set(a.map((o) => o.espacio))).toEqual(new Set(["frontal", "marca_deportiva"]));
  });

  it("aceptar una oferta firma el contrato y retira las demás de ese espacio", async () => {
    const ofertas = await m.p.ofertasPendientes(clubId);
    const o = ofertas.find((x) => x.espacio === "frontal")!;
    await m.p.aceptarOferta(clubId, o.id);
    const contratos = await m.p.contratosActivos(clubId);
    expect(contratos.find((c) => c.espacio === "frontal")?.marca).toBe(o.marca);
    const quedan = await m.p.ofertasPendientes(clubId);
    expect(quedan.some((x) => x.espacio === "frontal")).toBe(false);
    await expect(m.p.aceptarOferta(clubId, o.id)).rejects.toThrow();
  });

  it("la contraoferta solo se puede hacer una vez", async () => {
    const o = (await m.p.ofertasPendientes(clubId)).find((x) => x.espacio === "marca_deportiva")!;
    const r = await m.p.contraofertar(clubId, o.id, 0.01);
    expect(r.aceptada).toBe(true);
    await expect(m.p.contraofertar(clubId, o.id, 0.01)).rejects.toThrow(/una vez/);
  });

  it("el cierre de semana paga el contrato firmado y el hueco sin contratar", async () => {
    await m.liga.jugarJornadas(2);
    const mov = await m.bd.query<{ concepto: string; importe: number }>("select concepto, importe::float8 as importe from movimientos where club_id = $1 and concepto like 'Patrocinio%'", [clubId]);
    expect(mov.rows.some((r) => r.concepto.startsWith("Patrocinio: "))).toBe(true);
    expect(mov.rows.every((r) => r.importe > 0)).toBe(true);
  });

  it("la grada comenta la firma", async () => {
    const r = await m.bd.query<{ n: number }>("select count(*)::int as n from publicaciones where club_id = $1 and texto like '%PATROCINIO%'", [clubId]);
    expect(r.rows[0].n).toBeGreaterThan(0);
  });
});
