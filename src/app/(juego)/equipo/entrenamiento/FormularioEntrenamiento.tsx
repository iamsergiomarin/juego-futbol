"use client";

import { useActionState, useState } from "react";
import {
  DIAS,
  NOMBRE_ENFOQUE,
  NOMBRE_FOCO,
  NOMBRE_INTENSIDAD,
  type Enfoque,
  type Foco,
  type Intensidad,
  type PlanEntrenamiento,
} from "@/dominio/entrenamiento";
import { guardarPlanEntrenamiento, type EstadoGuardado } from "../../acciones";

export interface JugadorEntreno {
  id: string;
  nombre: string;
  posicion: "POR" | "DEF" | "MED" | "DEL";
  edad: number;
  media: number;
  potencialTexto: string;
  cansancio: number;
  lesion: number;
  foco: Foco | null;
  semana: Record<string, number>;
}

const NOMBRE_DIA = { martes: "Martes", jueves: "Jueves", viernes: "Viernes", domingo: "Domingo" } as const;
const CUANDO = { martes: "Tras el partido del lunes", jueves: "Mitad de semana", viernes: "Víspera del sábado", domingo: "Víspera del lunes" } as const;
const AYUDA_ENFOQUE: Record<Enfoque, string> = {
  fisico: "Velocidad, resistencia y fuerza.",
  tecnico: "Pase, regate, tiro, control y centros.",
  tactico: "Visión, colocación, decisión, entrada y juego aéreo.",
  balon_parado: "Centros, tiro y juego aéreo.",
  recuperacion: "No mejora atributos: quita cansancio.",
};

export function FormularioEntrenamiento({ planInicial, jugadores }: { planInicial: PlanEntrenamiento; jugadores: JugadorEntreno[] }) {
  const [plan, setPlan] = useState(planInicial);
  const [focos, setFocos] = useState<Record<string, Foco | null>>(Object.fromEntries(jugadores.map((j) => [j.id, j.foco])));
  const [estado, accion, guardando] = useActionState<EstadoGuardado, FormData>(guardarPlanEntrenamiento, {});

  return (
    <form action={accion} className="grid gap-5 xl:grid-cols-12">
      <input type="hidden" name="plan" value={JSON.stringify(plan)} />
      <input type="hidden" name="focos" value={JSON.stringify(focos)} />

      <section className="rounded-2xl border border-borde bg-superficie p-5 xl:col-span-5">
        <h2 className="font-semibold">Sesiones de la semana</h2>
        <p className="mt-1 text-sm text-suave">
          Los días sin partido. Más intensidad, más progreso, pero más cansancio y riesgo de lesión. Los lesionados no entrenan.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {DIAS.map((dia) => {
            const s = plan[dia];
            return (
              <li key={dia} className="rounded-xl bg-fondo p-3">
                <p className="font-semibold">{NOMBRE_DIA[dia]}</p>
                <p className="text-xs text-suave">{CUANDO[dia]}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    aria-label={`Enfoque del ${NOMBRE_DIA[dia]}`}
                    value={s.enfoque}
                    onChange={(e) => setPlan((p) => ({ ...p, [dia]: { ...p[dia], enfoque: e.target.value as Enfoque } }))}
                    className="rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(NOMBRE_ENFOQUE) as Enfoque[]).map((e) => (
                      <option key={e} value={e}>
                        {NOMBRE_ENFOQUE[e]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Intensidad del ${NOMBRE_DIA[dia]}`}
                    value={s.intensidad}
                    onChange={(e) => setPlan((p) => ({ ...p, [dia]: { ...p[dia], intensidad: e.target.value as Intensidad } }))}
                    className="rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(NOMBRE_INTENSIDAD) as Intensidad[]).map((i) => (
                      <option key={i} value={i}>
                        {NOMBRE_INTENSIDAD[i]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-xs text-suave">{AYUDA_ENFOQUE[s.enfoque]}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 rounded-xl bg-cesped-suave px-3 py-2 text-xs text-cesped">
          Consejo: el sábado y el lunes están muy juntos. Una sesión suave o de recuperación el domingo llega mejor al partido.
        </p>
      </section>

      <section className="min-w-0 rounded-2xl border border-borde bg-superficie xl:col-span-7">
        <div className="px-5 pt-5">
          <h2 className="font-semibold">Foco individual</h2>
          <p className="mt-1 text-sm text-suave">Se trabaja en todas las sesiones, además del enfoque del día. Los jóvenes son los que más lo notan.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-y border-borde text-left text-xs text-suave">
                <th className="py-2 pr-2 pl-5 font-medium">Jugador</th>
                <th className="px-2 py-2 text-right font-medium">Edad</th>
                <th className="px-2 py-2 text-right font-medium">Media</th>
                <th className="px-2 py-2 font-medium">Potencial estimado</th>
                <th className="px-2 py-2 text-center font-medium">Semana</th>
                <th className="py-2 pr-5 pl-2 font-medium">Foco</th>
              </tr>
            </thead>
            <tbody>
              {jugadores.map((j) => {
                const total = Object.values(j.semana).reduce((a, v) => a + v, 0);
                return (
                  <tr key={j.id} className="border-b border-borde/60 last:border-0">
                    <td className="py-1.5 pr-2 pl-5">
                      <span className="font-medium">{j.nombre}</span> <span className="text-xs text-suave">{j.posicion}</span>
                      {j.lesion > 0 ? <span className="ml-1.5 text-xs font-semibold text-rival">✚ lesionado</span> : null}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${j.edad <= 21 ? "font-semibold text-cesped" : ""}`}>{j.edad}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{j.media.toFixed(1).replace(".", ",")}</td>
                    <td className="px-2 py-1.5 text-suave">{j.potencialTexto}</td>
                    <td className={`px-2 py-1.5 text-center text-xs font-bold tabular-nums ${total > 0 ? "text-cesped" : total < 0 ? "text-rival" : "text-suave"}`}>
                      {total > 0 ? `+${total}` : total < 0 ? total : "—"}
                    </td>
                    <td className="py-1.5 pr-5 pl-2">
                      <select
                        aria-label={`Foco de ${j.nombre}`}
                        value={focos[j.id] ?? ""}
                        onChange={(e) => setFocos((f) => ({ ...f, [j.id]: (e.target.value || null) as Foco | null }))}
                        className="w-full rounded-lg border border-borde bg-fondo px-2 py-1 text-sm"
                      >
                        <option value="">Sin foco</option>
                        {(Object.keys(NOMBRE_FOCO) as Foco[])
                          .filter((f) => (j.posicion === "POR" ? f !== "tecnico" : f !== "porteria"))
                          .map((f) => (
                            <option key={f} value={f}>
                              {NOMBRE_FOCO[f]}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 xl:col-span-12">
        <button type="submit" disabled={guardando} className="rounded-full bg-cesped px-5 py-2.5 font-semibold text-white disabled:opacity-60 dark:text-black">
          {guardando ? "Guardando…" : "Guardar plan"}
        </button>
        {estado.ok ? <span className="text-sm font-medium text-cesped">{estado.ok}</span> : null}
        {estado.error ? <span className="text-sm font-medium text-rival">{estado.error}</span> : null}
      </div>
    </form>
  );
}
