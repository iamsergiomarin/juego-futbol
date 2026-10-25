import { describe, expect, it } from "vitest";
import {
  alineacionAutomatica,
  completarPlanteamiento,
  factorPosicion,
  planteamientoPorDefecto,
  puestos,
  validarPlanteamiento,
  type JugadorAlineable,
} from "./tactica";
import { aplicarSesion, recuperar, ritmoPorEdad, type JugadorEntrenable } from "./entrenamiento";
import { rangoAproximado, salarioPedido, valorJugador, ventanaAbierta } from "./mercado";

function plantilla(): JugadorAlineable[] {
  const pos: JugadorAlineable["posicion"][] = ["POR", "POR", "DEF", "DEF", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "MED", "MED", "DEL", "DEL", "DEL", "DEL"];
  return pos.map((posicion, i) => ({ id: `j${i}`, posicion, media: 3 + (i % 5) * 0.2, cansancio: 0, disponible: true }));
}

describe("táctica", () => {
  it("cada sistema tiene once puestos con un portero", () => {
    for (const f of ["4-4-2", "4-3-3", "4-5-1", "3-5-2", "5-3-2", "3-4-3"] as const) {
      const p = puestos(f);
      expect(p).toHaveLength(11);
      expect(p.filter((x) => x === "POR")).toHaveLength(1);
    }
  });

  it("penaliza jugar fuera de posición", () => {
    expect(factorPosicion("DEF", "DEF")).toBe(1);
    expect(factorPosicion("DEF", "MED")).toBeGreaterThan(factorPosicion("DEF", "DEL"));
    expect(factorPosicion("MED", "POR")).toBeLessThan(0.5);
  });

  it("la alineación automática pone a cada uno en su sitio y no repite", () => {
    const j = plantilla();
    const { once, banquillo } = alineacionAutomatica(j, "4-3-3");
    expect(once).toHaveLength(11);
    expect(new Set([...once, ...banquillo]).size).toBe(once.length + banquillo.length);
    const pos = puestos("4-3-3");
    once.forEach((id, i) => expect(j.find((x) => x.id === id)!.posicion).toBe(pos[i]));
  });

  it("deja fuera a los lesionados y a los muy cansados si hay alternativa", () => {
    const j = plantilla();
    j[2].disponible = false;
    j[3].cansancio = 1;
    const { once } = alineacionAutomatica(j, "4-4-2");
    expect(once).not.toContain("j2");
  });

  it("valida el planteamiento", () => {
    const j = plantilla();
    const p = planteamientoPorDefecto(j);
    const ids = new Set(j.map((x) => x.id));
    expect(validarPlanteamiento(p, ids)).toEqual([]);
    expect(validarPlanteamiento({ ...p, banquillo: [p.once[0]!] }, ids)).toContain("Un jugador no puede estar dos veces.");
  });

  it("el segundo entrenador cubre a un titular lesionado", () => {
    const j = plantilla();
    const p = planteamientoPorDefecto(j);
    const lesionado = p.once[3]!;
    j.find((x) => x.id === lesionado)!.disponible = false;
    const r = completarPlanteamiento(p, j);
    expect(r.planteamiento.once).not.toContain(lesionado);
    expect(r.planteamiento.once.every(Boolean)).toBe(true);
    expect(r.sustituciones).toEqual([{ sale: lesionado, entra: r.planteamiento.once[3] }]);
  });
});

describe("entrenamiento", () => {
  const joven = (): JugadorEntrenable => ({
    posicion: "MED",
    edad: 19,
    atributos: { pase: 40, regate: 40, tiro: 40, control: 40, centros: 40, aereo: 40, entrada: 40, velocidad: 40, resistencia: 40, fuerza: 40, vision: 40, colocacion: 40, decision: 40, temple: 40 },
    progreso: {},
    potencial: 75,
    media: 4,
    personalidad: "normal",
    foco: "tecnico",
    cansancio: 0,
  });

  it("un joven con potencial mejora claramente en una temporada de su foco", () => {
    const j = joven();
    const plan = [
      { enfoque: "fisico", intensidad: "normal" },
      { enfoque: "tecnico", intensidad: "normal" },
      { enfoque: "tactico", intensidad: "normal" },
      { enfoque: "recuperacion", intensidad: "suave" },
    ] as const;
    for (let s = 0; s < 76; s++) aplicarSesion(j, plan[s % 4], { calidadTecnicos: 30, nivelCiudad: 1 });
    expect(j.atributos.pase - 40).toBeGreaterThanOrEqual(6);
    expect(j.atributos.pase - 40).toBeLessThanOrEqual(14);
  });

  it("un veterano no mejora y pierde físico", () => {
    const j = { ...joven(), edad: 33, foco: null, atributos: { ...joven().atributos } };
    for (let s = 0; s < 76; s++) aplicarSesion(j, { enfoque: "fisico", intensidad: "normal" }, { calidadTecnicos: 30, nivelCiudad: 1 });
    expect(j.atributos.velocidad).toBeLessThan(40);
    expect(ritmoPorEdad(33)).toBe(0);
  });

  it("no pasa del techo de potencial", () => {
    const j = { ...joven(), potencial: 40 };
    for (let s = 0; s < 76; s++) aplicarSesion(j, { enfoque: "tecnico", intensidad: "intensa" }, { calidadTecnicos: 60, nivelCiudad: 3 });
    expect(j.atributos.pase).toBeLessThanOrEqual(43);
  });

  it("la recuperación baja el cansancio con los días", () => {
    expect(recuperar(0.6, 5, 30)).toBeLessThan(0.05);
    expect(recuperar(0.6, 2, 30)).toBeGreaterThan(0.3);
  });
});

describe("mercado", () => {
  it("los jóvenes valen más y los veteranos menos", () => {
    expect(valorJugador(4, 20)).toBeGreaterThan(valorJugador(4, 26));
    expect(valorJugador(4, 32)).toBeLessThan(valorJugador(4, 26));
  });

  it("un ambicioso pide más que un tímido", () => {
    expect(salarioPedido({ media: 4, salario: 50_000, personalidad: "ambicioso" }, 5)).toBeGreaterThan(
      salarioPedido({ media: 4, salario: 50_000, personalidad: "timido" }, 5),
    );
  });

  it("abre la ventana en pretemporada y en las semanas 9 a 11", () => {
    expect(ventanaAbierta(0, "liga")).toBe(true);
    expect(ventanaAbierta(5, "liga")).toBe(false);
    expect(ventanaAbierta(16, "liga")).toBe(true);
    expect(ventanaAbierta(22, "liga")).toBe(false);
    expect(ventanaAbierta(38, "terminada")).toBe(true);
  });

  it("el rango del ojeador contiene el valor real y no cambia", () => {
    const r = rangoAproximado(55, 10, "abc");
    expect(r[0]).toBeLessThanOrEqual(55);
    expect(r[1]).toBeGreaterThanOrEqual(55);
    expect(rangoAproximado(55, 10, "abc")).toEqual(r);
  });
});
