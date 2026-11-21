import { describe, expect, it } from "vitest";
import { crearRng } from "@/motor";
import { generarOfertas, importeBase, importeSinContrato, liquidarContrato, resolverContraoferta } from "./patrocinio";
import { PATROCINIO } from "./reglas";

const parametros = (extra = {}) => ({ espacio: "frontal" as const, presupuesto: 2_000_000, popularidad: 50, rng: crearRng(5), ...extra });

describe("patrocinio", () => {
  it("el frontal de Quinta ronda los 300.000 € del diseño", () => {
    expect(importeBase(2_000_000, "frontal")).toBe(300_000);
    expect(importeBase(2_000_000, "marca_deportiva")).toBe(200_000);
  });

  it("genera una oferta por perfil, con apuestas pagando más que local", () => {
    const o = generarOfertas(parametros());
    expect(o.map((x) => x.perfil).sort()).toEqual(["apuestas", "local", "multinacional"]);
    const por = (p: string) => o.find((x) => x.perfil === p)!.fijo;
    expect(por("apuestas")).toBeGreaterThan(por("local"));
    expect(new Set(o.map((x) => x.marca)).size).toBe(3);
  });

  it("es determinista con la misma semilla", () => {
    expect(generarOfertas(parametros({ rng: crearRng(9) }))).toEqual(generarOfertas(parametros({ rng: crearRng(9) })));
  });

  it("una marca satisfecha renueva al alza y una excluida no aparece", () => {
    const o = generarOfertas(parametros({ renovacion: { marca: "Quesos de la Vega", perfil: "local" }, excluidas: ["Aurelia Global"] }));
    const r = o.find((x) => x.renovacion)!;
    expect(r.marca).toBe("Quesos de la Vega");
    expect(o.filter((x) => x.perfil === "local")).toHaveLength(1);
    expect(o.some((x) => x.marca === "Aurelia Global")).toBe(false);
  });

  it("la contraoferta mejora el contrato si cabe en el margen y lo retira si no", () => {
    expect(resolverContraoferta(300_000, 0.1, 0.08)).toEqual({ aceptada: true, fijo: 324_000 });
    expect(resolverContraoferta(300_000, 0.1, 0.15).aceptada).toBe(false);
  });

  it("la liquidación premia el objetivo y descontenta al patrocinador si el equipo falla", () => {
    const base = { perfil: "apuestas" as const, satisfaccion: 50, objetivoPosicion: PATROCINIO.objetivoPosicion };
    expect(liquidarContrato(base, 3)).toMatchObject({ cobraPrima: true, satisfaccion: 62, seMarcha: false, popularidad: -3 });
    const mal = liquidarContrato({ ...base, satisfaccion: 35 }, 15);
    expect(mal.cobraPrima).toBe(false);
    expect(mal.seMarcha).toBe(true);
  });

  it("el hueco sin contrato rinde menos", () => {
    expect(importeSinContrato(2_000_000, "frontal")).toBe(180_000);
  });
});
