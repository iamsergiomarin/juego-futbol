import { describe, expect, it } from "vitest";
import { despuesDeJornada, diaActual, diasDesbloqueados } from "./entrenamiento";

describe("semana de entrenamiento", () => {
  it("tras el partido del lunes hay cuatro sesiones y tras el del sábado, una", () => {
    expect(despuesDeJornada(1).dias).toEqual(["martes", "miercoles", "jueves", "viernes"]);
    expect(despuesDeJornada(2).dias).toEqual(["domingo"]);
    expect(despuesDeJornada(0).dias).toEqual([]);
  });

  it("el día actual avanza con las sesiones hechas hasta llegar al partido", () => {
    expect(diaActual(0, 0)).toBe("lunes");
    expect(diaActual(1, 0)).toBe("martes");
    expect(diaActual(1, 3)).toBe("viernes");
    expect(diaActual(1, 4)).toBe("sabado");
    expect(diaActual(2, 0)).toBe("domingo");
    expect(diaActual(2, 1)).toBe("lunes");
  });

  it("solo se desbloquean ayer, hoy y mañana, también al dar la vuelta a la semana", () => {
    expect(diasDesbloqueados("miercoles")).toEqual(["martes", "miercoles", "jueves"]);
    expect(diasDesbloqueados("lunes")).toEqual(["domingo", "lunes", "martes"]);
    expect(diasDesbloqueados("domingo")).toEqual(["sabado", "domingo", "lunes"]);
  });
});
