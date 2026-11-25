import { describe, expect, it } from "vitest";
import { crearRng } from "@/motor";
import {
  analizarPartido,
  animoTrasPartido,
  crearVoces,
  etiquetaAnimo,
  factorTaquilla,
  previaPartido,
  reacciones,
  reaccionesEvento,
  reaccionesPartido,
  type Clase,
  type ContextoPartido,
  type EventoClub,
  type Voz,
} from "./grada";
import { GRADA } from "./reglas";

const voces: Voz[] = crearVoces(crearRng(1), { nombre: "Real Valladolid", corto: "RVA", ciudad: "Valladolid" }).map((v, i) => ({ ...v, id: i + 1 }));

function ctx(p: Partial<ContextoPartido> & { goles?: ContextoPartido["goles"] }): ContextoPartido {
  const goles = p.goles ?? [];
  return {
    club: "Real Valladolid",
    rival: "Racing Laguna Seca",
    rivalCorto: "RLS",
    local: true,
    jornada: 12,
    competicion: "liga",
    ronda: null,
    golesPropios: goles.filter((g) => g.propio).length,
    golesRivales: goles.filter((g) => !g.propio).length,
    posicion: 6,
    puntos: 18,
    equipos: 20,
    racha: ["E"],
    lesionados: [],
    asistencia: 1500,
    aforo: 2000,
    ...p,
    goles,
  };
}
const p = (minuto: number, jugador = "Nacho Vicente") => ({ minuto, propio: true, jugador });
const r = (minuto: number) => ({ minuto, propio: false });

describe("clasificación del partido", () => {
  const casos: [string, ContextoPartido, Clase][] = [
    ["goleada", ctx({ goles: [p(5), p(20), p(60), p(75), r(70)], racha: ["G"] }), "goleada"],
    ["victoria", ctx({ goles: [p(30), p(55), r(80)], racha: ["G"] }), "victoria"],
    ["agonía", ctx({ goles: [r(10), p(40), p(90)], racha: ["G"] }), "agonia"],
    ["remontada", ctx({ goles: [r(10), p(40), p(70)], racha: ["G"] }), "remontada"],
    ["empate", ctx({ goles: [p(10), r(50)] }), "empate"],
    ["empate rescatado", ctx({ goles: [r(10), p(89)] }), "empate_final"],
    ["0-0", ctx({ goles: [] }), "empate0"],
    ["derrota", ctx({ goles: [r(10), r(50)], racha: ["P"] }), "derrota"],
    ["derrota dura", ctx({ goles: [r(10), r(50), r(60), r(80)], racha: ["P"] }), "derrota_dura"],
    ["derrota tardía", ctx({ goles: [p(10), r(60), r(90)], racha: ["P"] }), "derrota_tarde"],
  ];
  for (const [nombre, c, esperada] of casos) {
    it(`reconoce ${nombre}`, () => expect(analizarPartido(c).clase).toBe(esperada));
  }

  it("calcula rachas", () => {
    const a = analizarPartido(ctx({ goles: [p(5)], racha: ["G", "G", "G", "E", "P"] }));
    expect(a.rachaN).toBe(3);
    expect(a.sinPerder).toBe(4);
    expect(analizarPartido(ctx({ goles: [r(5)], racha: ["P", "P", "E", "E", "E", "E"] })).sinGanar).toBe(6);
  });
});

describe("voces de un club", () => {
  it("son nueve, con usuarios distintos y la cuenta oficial", () => {
    expect(voces).toHaveLength(9);
    expect(new Set(voces.map((v) => v.usuario)).size).toBe(9);
    expect(voces.find((v) => v.rasgo === "oficial")?.nombre).toBe("Real Valladolid");
    expect(voces.every((v) => /^@[a-z0-9_]+$/.test(v.usuario))).toBe(true);
  });
});

describe("reacciones a un partido", () => {
  const partidos: ContextoPartido[] = [
    ctx({ goles: [p(5), p(20), p(60), r(70)], racha: ["G", "G", "G"], posicion: 1 }),
    ctx({ goles: [r(10), p(40), p(90)], racha: ["G"] }),
    ctx({ goles: [r(10), p(40), p(70), p(80, "Otro Jugador")], racha: ["G"], lesionados: [{ nombre: "Pablo Cuesta", tipo: "Esguince", jornadas: 3 }] }),
    ctx({ goles: [p(10), p(40), p(70)], racha: ["G"] }),
    ctx({ goles: [], local: false, asistencia: 600 }),
    ctx({ goles: [r(10), r(50), r(60), r(80)], racha: ["P", "P", "P"], posicion: 19 }),
    ctx({ goles: [p(10), r(60), r(90)], racha: ["P"], competicion: "playoff", ronda: "Semifinal", eliminatoria: { pasa: false, penaltis: false } }),
    ctx({ goles: [p(10), r(50)], asistencia: 400, racha: ["E", "E", "E", "E", "E"] }),
  ];

  it("siempre cuenta con la cuenta oficial, la prensa y la afición, sin marcas sin rellenar", () => {
    for (const [i, c] of partidos.entries()) {
      const borradores = reaccionesPartido(c, voces, crearRng(i + 10));
      expect(borradores.length).toBeGreaterThanOrEqual(6);
      expect(borradores[0].autor.tipo).toBe("club");
      expect(borradores.some((b) => b.autor.tipo === "prensa")).toBe(true);
      expect(borradores.some((b) => b.autor.tipo === "aficion")).toBe(true);
      expect(borradores.some((b) => b.autor.tipo === "pena")).toBe(true);
      for (const b of borradores) {
        expect(b.texto, b.texto).not.toMatch(/[{}]/);
        expect(b.texto.length).toBeGreaterThan(8);
        expect(b.alcance).toBeGreaterThan(0);
      }
    }
  });

  it("las respuestas cuelgan de una publicación anterior", () => {
    const borradores = reaccionesPartido(partidos[0], voces, crearRng(3));
    borradores.forEach((b, i) => {
      if (b.respuestaA !== undefined) expect(b.respuestaA).toBeLessThan(i);
    });
    expect(borradores.some((b) => b.autor.tipo === "rival" && b.respuestaA === 0)).toBe(true);
  });

  it("menciona al goleador y el parte médico", () => {
    const todo = reaccionesPartido(partidos[2], voces, crearRng(4)).map((b) => b.texto).join("\n");
    expect(todo).toContain("Nacho Vicente");
    expect(todo).toContain("Pablo Cuesta");
    expect(todo).toContain("PARTE MÉDICO");
  });

  it("el marcador respeta quién juega en casa", () => {
    const fuera = reaccionesPartido(ctx({ goles: [p(10), p(20), r(30)], local: false }), voces, crearRng(5));
    expect(fuera[0].texto + fuera.map((b) => b.texto).join(" ")).toContain("Racing Laguna Seca 1-2 Real Valladolid");
  });

  it("es determinista con la misma semilla", () => {
    const a = reaccionesPartido(partidos[1], voces, crearRng(7));
    const b = reaccionesPartido(partidos[1], voces, crearRng(7));
    expect(a).toEqual(b);
  });

  it("cada tipo de partido tiene textos en todos los rasgos", () => {
    const clases = new Set<string>();
    for (let semilla = 0; semilla < 400; semilla++) {
      const goles = [];
      const n1 = Math.floor(crearRng(semilla)() * 5);
      const n2 = Math.floor(crearRng(semilla + 999)() * 5);
      for (let i = 0; i < n1; i++) goles.push(p(10 + i * 20 + (semilla % 7) * 5));
      for (let i = 0; i < n2; i++) goles.push(r(8 + i * 22 + (semilla % 5) * 9));
      const c = ctx({ goles: goles.map((g) => ({ ...g, minuto: Math.min(94, g.minuto) })), racha: ["G"] });
      clases.add(analizarPartido(c).clase);
      for (const b of reaccionesPartido(c, voces, crearRng(semilla))) expect(b.texto).not.toMatch(/[{}]/);
    }
    expect(clases.size).toBe(10);
  });
});

describe("previa", () => {
  it("anuncia el partido y rellena todas las marcas", () => {
    for (const local of [true, false]) {
      const b = previaPartido(
        { club: "Real Valladolid", rival: "CF Peñaclara", rivalCorto: "PEN", local, jornada: 3, competicion: "liga", ronda: null, cuando: "el sábado a las 21:00", posicion: 4, puntos: 5, jugados: 2 },
        voces,
        crearRng(2),
      );
      expect(b.length).toBeGreaterThanOrEqual(4);
      for (const x of b) expect(x.texto).not.toMatch(/[{}]/);
      expect(b.map((x) => x.texto).join(" ")).toContain("CF Peñaclara");
    }
  });
});

describe("acontecimientos del club", () => {
  const eventos: EventoClub[] = [
    { tipo: "bienvenida", club: "Real Valladolid", manager: "Sergio", ciudad: "Valladolid", division: "Quinta" },
    { tipo: "fichaje", club: "Real Valladolid", jugador: "Iván Herrero", posicion: "DEL", media: 4.5, edad: 24, libre: false, precio: 120000, mediaEquipo: 3.6 },
    { tipo: "fichaje", club: "Real Valladolid", jugador: "Iván Herrero", posicion: "POR", media: 3.0, edad: 20, libre: true, precio: 0, mediaEquipo: 3.6 },
    { tipo: "venta", club: "Real Valladolid", jugador: "Nacho Vicente", posicion: "DEL", media: 4.3, edad: 18, precio: 400000, comprador: "CF Peñaclara", mediaEquipo: 3.6 },
    { tipo: "venta", club: "Real Valladolid", jugador: "Toni Zamora", posicion: "DEF", media: 2.8, edad: 27, precio: 60000, comprador: "CF Peñaclara", mediaEquipo: 3.6 },
    { tipo: "renovacion", club: "Real Valladolid", jugador: "Nacho Vicente", media: 4.3, hasta: 5, mediaEquipo: 3.6 },
    { tipo: "campeon", club: "Real Valladolid", puntos: 80, division: "Quinta", siguiente: "Cuarta" },
    { tipo: "playoff", club: "Real Valladolid", posicion: 3 },
    { tipo: "ascenso", club: "Real Valladolid", division: "Quinta", siguiente: "Cuarta" },
    { tipo: "eliminado", club: "Real Valladolid", ronda: "Final" },
    { tipo: "nueva_temporada", club: "Real Valladolid", numero: 2, division: "Cuarta" },
  ];

  it("todos generan publicaciones completas", () => {
    for (const ev of eventos) {
      const { borradores } = reaccionesEvento(ev, voces, crearRng(5));
      expect(borradores.length, ev.tipo).toBeGreaterThanOrEqual(3);
      for (const b of borradores) expect(b.texto, b.texto).not.toMatch(/[{}]/);
    }
  });

  it("vender a la estrella enfada a la grada y fichar a una ilusiona", () => {
    expect(reaccionesEvento(eventos[3], voces, crearRng(1)).animo).toBeLessThan(0);
    expect(reaccionesEvento(eventos[4], voces, crearRng(1)).animo).toBe(0);
    expect(reaccionesEvento(eventos[1], voces, crearRng(1)).animo).toBeGreaterThan(reaccionesEvento(eventos[2], voces, crearRng(1)).animo);
    expect(reaccionesEvento(eventos[6], voces, crearRng(1)).animo).toBeGreaterThan(10);
  });
});

describe("ánimo de la grada", () => {
  it("sube con las victorias y baja con las derrotas, dentro de 0-100", () => {
    expect(animoTrasPartido(60, "victoria", true)).toBeGreaterThan(60);
    expect(animoTrasPartido(60, "derrota", true)).toBeLessThan(60);
    expect(animoTrasPartido(99, "goleada", true)).toBeLessThanOrEqual(100);
    expect(animoTrasPartido(2, "derrota_dura", true)).toBeGreaterThanOrEqual(0);
  });
  it("tiende al punto neutro con el tiempo", () => {
    let a = 100;
    for (let i = 0; i < 80; i++) a = animoTrasPartido(a, "empate", false);
    expect(Math.abs(a - GRADA.animoNeutro)).toBeLessThanOrEqual(2);
  });
  it("la taquilla es neutra con el ánimo inicial y acotada", () => {
    expect(factorTaquilla(GRADA.animoInicial)).toBe(1);
    expect(factorTaquilla(100)).toBeGreaterThan(1);
    expect(factorTaquilla(0)).toBeGreaterThanOrEqual(GRADA.taquillaMinima);
    expect(factorTaquilla(0)).toBeLessThan(1);
  });
  it("etiqueta el ambiente", () => {
    expect(etiquetaAnimo(90).texto).toBe("Eufórica");
    expect(etiquetaAnimo(10).tono).toBe("negativo");
  });
  it("los me gusta crecen con el alcance y el tamaño de la afición", () => {
    const rng = () => 0.5;
    expect(reacciones(rng, 1, 5000, 60).meGusta).toBeGreaterThan(reacciones(rng, 1, 500, 60).meGusta);
    expect(reacciones(rng, 1.2, 500, 60).meGusta).toBeGreaterThan(reacciones(rng, 0.3, 500, 60).meGusta);
  });
});

describe("comunicados del club", () => {
  it("limpia espacios y rechaza vacíos o demasiado largos", async () => {
    const { limpiarComunicado, LIMITE_COMUNICADO } = await import("./grada");
    expect(limpiarComunicado("  Hola \n  afición  ")).toBe("Hola afición");
    expect(limpiarComunicado("  ")).toBeNull();
    expect(limpiarComunicado("x".repeat(LIMITE_COMUNICADO + 1))).toBeNull();
  });

  it("la grada contesta, con tono distinto según el ánimo, y respeta el texto tal cual", async () => {
    const { reaccionesComunicado } = await import("./grada");
    const alegre = reaccionesComunicado("Entradas a {club} 10 €", 80, voces, crearRng(1));
    expect(alegre[0].texto).toBe("Entradas a {club} 10 €");
    expect(alegre.length).toBeGreaterThan(1);
    expect(alegre.slice(1).every((b) => b.respuestaA === 0 && b.tono === "positivo")).toBe(true);
    expect(reaccionesComunicado("Hola", 20, voces, crearRng(1)).slice(1).every((b) => b.tono === "neutro")).toBe(true);
  });
});
