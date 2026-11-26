"use client";

import { useActionState, useState } from "react";
import {
  diasDesbloqueados,
  NOMBRE_DIA,
  NOMBRE_ENFOQUE,
  SEMANA,
  type DiaEntreno,
  type DiaSemana,
  NOMBRE_FOCO,
  NOMBRE_INTENSIDAD,
  type Enfoque,
  type Foco,
  type Intensidad,
  type PlanEntrenamiento,
} from "@/dominio/entrenamiento";
import {
  avanzarDia,
  guardarPlanEntrenamiento,
  type EstadoGuardado,
} from "../../acciones";

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

const CUANDO: Record<DiaSemana, string> = {
  lunes: "Partido de liga",
  martes: "Tras el partido del lunes",
  miercoles: "Mitad de semana",
  jueves: "Mitad de semana",
  viernes: "Víspera del sábado",
  sabado: "Partido de liga",
  domingo: "Víspera del lunes",
};
const AYUDA_ENFOQUE: Record<Enfoque, string> = {
  fisico: "Velocidad, resistencia y fuerza.",
  tecnico: "Pase, regate, tiro, control y centros.",
  tactico: "Visión, colocación, decisión, entrada y juego aéreo.",
  balon_parado: "Centros, tiro y juego aéreo.",
  recuperacion: "No mejora atributos: quita cansancio.",
};

export function FormularioEntrenamiento({
  planInicial,
  jugadores,
  hoy,
  hechos,
  diasPendientes,
}: {
  planInicial: PlanEntrenamiento;
  jugadores: JugadorEntreno[];
  hoy: DiaSemana;
  /** Sesiones de esta semana que ya se han hecho. */
  hechos: DiaEntreno[];
  diasPendientes: number;
}) {
  const abiertos = diasDesbloqueados(hoy);
  const etiquetaDia = (d: DiaSemana) =>
    d === hoy
      ? "Hoy"
      : abiertos[0] === d
        ? "Ayer"
        : abiertos[2] === d
          ? "Mañana"
          : null;
  const [plan, setPlan] = useState(planInicial);
  const [focos, setFocos] = useState<Record<string, Foco | null>>(
    Object.fromEntries(jugadores.map((j) => [j.id, j.foco])),
  );
  const [estado, accion, guardando] = useActionState<EstadoGuardado, FormData>(
    guardarPlanEntrenamiento,
    {},
  );

  return (
    <div className="grid gap-5">
      <form
        action={avanzarDia}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borde bg-superficie p-4"
      >
        <p className="text-sm">
          <span className="titulo text-xl font-semibold">
            Hoy es {NOMBRE_DIA[hoy].toLowerCase()}.
          </span>{" "}
          <span className="text-suave">
            {diasPendientes > 0
              ? `Quedan ${diasPendientes} ${diasPendientes === 1 ? "sesión" : "sesiones"} hasta el partido.`
              : "No quedan sesiones: toca jugar el partido."}
          </span>
        </p>
        {diasPendientes > 0 ? (
          <button className="rounded-full bg-cesped px-5 py-2 text-sm font-semibold text-white dark:text-black">
            Pasar al siguiente día
          </button>
        ) : null}
      </form>

      <form action={accion} className="grid gap-5 xl:grid-cols-12">
        <input type="hidden" name="plan" value={JSON.stringify(plan)} />
        <input type="hidden" name="focos" value={JSON.stringify(focos)} />

        <section className="rounded-2xl border border-borde bg-superficie p-5 xl:col-span-12">
          <h2 className="titulo text-2xl font-semibold">
            Semana de entrenamiento
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-suave">
            Solo se pueden ajustar ayer, hoy y mañana: el resto de la semana se
            desbloquea según pasan los días. Más intensidad, más progreso, pero
            más cansancio y riesgo de lesión. Los lesionados no entrenan.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {SEMANA.map((dia) => {
              const nombre = NOMBRE_DIA[dia];
              const marca = etiquetaDia(dia);
              const cabecera = (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="titulo text-xl font-semibold">{nombre}</p>
                  {marca ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${dia === hoy ? "bg-cesped text-white dark:text-black" : "bg-cesped-suave text-cesped"}`}
                    >
                      {marca}
                    </span>
                  ) : null}
                </div>
              );
              if (dia === "lunes" || dia === "sabado") {
                return (
                  <li
                    key={dia}
                    className="rounded-xl border border-dashed border-borde p-3"
                  >
                    {cabecera}
                    <p className="mt-2 text-sm font-semibold">Día de partido</p>
                    <p className="text-xs text-suave">
                      Sin sesión de entrenamiento.
                    </p>
                  </li>
                );
              }
              const s = plan[dia];
              const libre = abiertos.includes(dia);
              const hecho = hechos.includes(dia);
              return (
                <li
                  key={dia}
                  className={`rounded-xl p-3 ${libre ? "bg-fondo ring-1 ring-cesped/40" : "bg-fondo/60"}`}
                >
                  {cabecera}
                  <p className="text-xs text-suave">
                    {hecho ? "Sesión hecha" : CUANDO[dia]}
                  </p>
                  {libre ? (
                    <>
                      <div className="mt-2 grid gap-2">
                        <select
                          aria-label={`Enfoque del ${nombre}`}
                          value={s.enfoque}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              [dia]: {
                                ...p[dia],
                                enfoque: e.target.value as Enfoque,
                              },
                            }))
                          }
                          className="rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm"
                        >
                          {(Object.keys(NOMBRE_ENFOQUE) as Enfoque[]).map(
                            (e) => (
                              <option key={e} value={e}>
                                {NOMBRE_ENFOQUE[e]}
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          aria-label={`Intensidad del ${nombre}`}
                          value={s.intensidad}
                          onChange={(e) =>
                            setPlan((p) => ({
                              ...p,
                              [dia]: {
                                ...p[dia],
                                intensidad: e.target.value as Intensidad,
                              },
                            }))
                          }
                          className="rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm"
                        >
                          {(Object.keys(NOMBRE_INTENSIDAD) as Intensidad[]).map(
                            (i) => (
                              <option key={i} value={i}>
                                {NOMBRE_INTENSIDAD[i]}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <p className="mt-1.5 text-xs text-suave">
                        {hecho
                          ? "Ya entrenado: el cambio vale para la próxima semana."
                          : AYUDA_ENFOQUE[s.enfoque]}
                      </p>
                    </>
                  ) : (
                    <div className="mt-2" aria-label={`${nombre} bloqueado`}>
                      <p className="text-sm font-semibold">
                        {NOMBRE_ENFOQUE[s.enfoque]}
                      </p>
                      <p className="text-xs text-suave">
                        {NOMBRE_INTENSIDAD[s.intensidad]} · bloqueado
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 rounded-xl bg-cesped-suave px-3 py-2 text-xs text-cesped">
            Consejo: el sábado y el lunes están muy juntos. Una sesión suave o
            de recuperación el domingo llega mejor al partido.
          </p>
        </section>

        <section className="min-w-0 rounded-2xl border border-borde bg-superficie xl:col-span-12">
          <div className="px-5 pt-5">
            <h2 className="font-semibold">Foco individual</h2>
            <p className="mt-1 text-sm text-suave">
              Se trabaja en todas las sesiones, además del enfoque del día. Los
              jóvenes son los que más lo notan.
            </p>
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
                  const total = Object.values(j.semana).reduce(
                    (a, v) => a + v,
                    0,
                  );
                  return (
                    <tr
                      key={j.id}
                      className="border-b border-borde/60 last:border-0"
                    >
                      <td className="py-1.5 pr-2 pl-5">
                        <span className="font-medium">{j.nombre}</span>{" "}
                        <span className="text-xs text-suave">{j.posicion}</span>
                        {j.lesion > 0 ? (
                          <span className="ml-1.5 text-xs font-semibold text-rival">
                            ✚ lesionado
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${j.edad <= 21 ? "font-semibold text-cesped" : ""}`}
                      >
                        {j.edad}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {j.media.toFixed(1).replace(".", ",")}
                      </td>
                      <td className="px-2 py-1.5 text-suave">
                        {j.potencialTexto}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-center text-xs font-bold tabular-nums ${total > 0 ? "text-cesped" : total < 0 ? "text-rival" : "text-suave"}`}
                      >
                        {total > 0 ? `+${total}` : total < 0 ? total : "—"}
                      </td>
                      <td className="py-1.5 pr-5 pl-2">
                        <select
                          aria-label={`Foco de ${j.nombre}`}
                          value={focos[j.id] ?? ""}
                          onChange={(e) =>
                            setFocos((f) => ({
                              ...f,
                              [j.id]: (e.target.value || null) as Foco | null,
                            }))
                          }
                          className="w-full rounded-lg border border-borde bg-fondo px-2 py-1 text-sm"
                        >
                          <option value="">Sin foco</option>
                          {(Object.keys(NOMBRE_FOCO) as Foco[])
                            .filter((f) =>
                              j.posicion === "POR"
                                ? f !== "tecnico"
                                : f !== "porteria",
                            )
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
          <button
            type="submit"
            disabled={guardando}
            className="rounded-full bg-cesped px-5 py-2.5 font-semibold text-white disabled:opacity-60 dark:text-black"
          >
            {guardando ? "Guardando…" : "Guardar plan"}
          </button>
          {estado.ok ? (
            <span className="text-sm font-medium text-cesped">{estado.ok}</span>
          ) : null}
          {estado.error ? (
            <span className="text-sm font-medium text-rival">
              {estado.error}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
