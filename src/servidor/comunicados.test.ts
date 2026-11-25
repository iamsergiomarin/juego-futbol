import { describe, expect, it } from "vitest";

process.env.DATOS_LOCALES = "memoria";

describe("comunicados del club (servidor)", () => {
  it("publica con la cuenta oficial y limita a dos por jornada", async () => {
    const mundo = await import("./mundo");
    const g = await import("./grada");
    const bd = await (await import("./bd")).bdLocal();
    const club = await mundo.crearPartidaLocal(
      { nombreManager: "Ana", nombreClub: "Club Prueba", abreviatura: "CPR", ciudad: "Pruebas", colorPrincipal: "#112233", colorSecundario: "#ffffff" },
      77,
    );
    await g.asegurarGrada();
    await g.publicarComunicado(club, "Primer comunicado");
    await g.publicarComunicado(club, "Segundo comunicado");
    await expect(g.publicarComunicado(club, "Tercero")).rejects.toThrow(/dos comunicados/);
    await expect(g.publicarComunicado(club, " ")).rejects.toThrow(/entre 3/);
    const r = await bd.query<{ n: number }>("select count(*)::int as n from publicaciones where club_id = $1 and comunicado and autor_tipo = 'club'", [club]);
    expect(r.rows[0].n).toBe(2);
  });
});
