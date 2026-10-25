"use client";

import { useActionState, useMemo, useState } from "react";
import type { Condicional, Mentalidad, Posicion, Presion } from "@/motor";
import {
  alineacionAutomatica,
  DESCRIPCION_FORMACION,
  factorPosicion,
  FORMACIONES,
  MAX_BANQUILLO,
  MAX_CONDICIONALES,
  puestos,
  type Formacion,
  type Planteamiento,
} from "@/dominio/tactica";
import { guardarAlineacion, type EstadoGuardado } from "../../acciones";

export interface JugadorOpcion {
  id: string;
  nombre: string;
  posicion: Posicion;
  media: number;
  cansancio: number;
  forma: number;
  lesion: number;
}

const NOMBRE_PUESTO: Record<Posicion, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };
const MENTALIDADES: [Mentalidad, string, string][] = [
  ["defensiva", "Defensiva", "Menos peligro en las dos áreas"],
  ["equilibrada", "Equilibrada", "Sin riesgos de más"],
  ["ofensiva", "Ofensiva", "Más ocasiones a favor y en contra"],
];
const PRESIONES: [Presion, string, string][] = [
  ["baja", "Baja", "Cansa menos, cede el balón"],
  ["normal", "Normal", "Lo habitual"],
  ["alta", "Alta", "Recupera antes, agota más"],
];

const coma = (n: number) => n.toFixed(1).replace(".", ",");

function etiqueta(j: JugadorOpcion, puesto?: Posicion): string {
  const energia = Math.round(100 - j.cansancio * 100);
  const fuera = puesto && factorPosicion(j.posicion, puesto) < 1 ? ` · fuera de posición ${Math.round(factorPosicion(j.posicion, puesto) * 100)} %` : "";
  return `${j.nombre} · ${j.posicion} · ${coma(j.media)} · ${energia} %${j.lesion > 0 ? " · LESIONADO" : ""}${fuera}`;
}

function Segmentos<T extends string>({
  valor,
  opciones,
  onChange,
  nombre,
}: {
  valor: T;
  opciones: [T, string, string][];
  onChange: (v: T) => void;
  nombre: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{nombre}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-fondo p-1">
        {opciones.map(([v, texto, ayuda]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={ayuda}
            aria-pressed={valor === v}
            className={`rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${valor === v ? "bg-superficie shadow-sm" : "text-suave hover:text-texto"}`}
          >
            {texto}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-suave">{opciones.find((o) => o[0] === valor)?.[2]}</p>
    </fieldset>
  );
}

export function FormularioAlineacion({ jugadores, inicial }: { jugadores: JugadorOpcion[]; inicial: Planteamiento }) {
  const [p, setP] = useState<Planteamiento>(inicial);
  const [estado, accion, guardando] = useActionState<EstadoGuardado, FormData>(guardarAlineacion, {});
  const porId = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);
  const huecos = puestos(p.formacion);
  const usados = new Set([...p.once, ...p.banquillo].filter(Boolean) as string[]);

  const automatica = (formacion: Formacion) => {
    const r = alineacionAutomatica(
      jugadores.map((j) => ({ id: j.id, posicion: j.posicion, media: j.media, cansancio: j.cansancio, disponible: j.lesion === 0 })),
      formacion,
    );
    setP((x) => ({ ...x, formacion, once: r.once, banquillo: r.banquillo }));
  };

  const cambiarFormacion = (f: Formacion) => {
    // Recoloca a los titulares en los nuevos puestos por posición; los huecos se completan solos.
    const anteriores = p.once.filter(Boolean) as string[];
    const nuevos = puestos(f).map(() => null as string | null);
    const libres = [...anteriores];
    puestos(f).forEach((puesto, i) => {
      const k = libres.findIndex((id) => porId.get(id)?.posicion === puesto);
      if (k >= 0) nuevos[i] = libres.splice(k, 1)[0];
    });
    nuevos.forEach((v, i) => {
      if (!v && libres.length) nuevos[i] = libres.shift()!;
    });
    setP((x) => ({ ...x, formacion: f, once: nuevos, banquillo: [...x.banquillo.filter((id) => !nuevos.includes(id)), ...libres].slice(0, MAX_BANQUILLO) }));
  };

  const ponerEnPuesto = (i: number, id: string) =>
    setP((x) => {
      const once = [...x.once];
      const anterior = once[i];
      const desde = once.indexOf(id);
      if (desde >= 0) once[desde] = anterior; // intercambio dentro del once
      once[i] = id || null;
      const banquillo = x.banquillo.filter((b) => b !== id);
      if (anterior && desde < 0 && id) banquillo.unshift(anterior);
      return { ...x, once, banquillo: banquillo.slice(0, MAX_BANQUILLO) };
    });

  const ponerEnBanquillo = (i: number, id: string) =>
    setP((x) => {
      const banquillo = [...x.banquillo];
      if (id) {
        const otro = banquillo.indexOf(id);
        if (otro >= 0) banquillo.splice(otro, 1);
        banquillo[i] = id;
      } else banquillo.splice(i, 1);
      return { ...x, banquillo: banquillo.filter(Boolean).slice(0, MAX_BANQUILLO), once: x.once.map((o) => (o === id ? null : o)) };
    });

  const cambiarCondicional = (i: number, c: Partial<Condicional> & { accion?: Condicional["accion"] }) =>
    setP((x) => ({ ...x, condicionales: x.condicionales.map((k, j) => (j === i ? { ...k, ...c, accion: { ...k.accion, ...c.accion } } : k)) }));

  // Líneas para pintar el campo: delanteros arriba, portero abajo.
  const lineas: { pos: Posicion; indices: number[] }[] = (["DEL", "MED", "DEF", "POR"] as Posicion[]).map((pos) => ({
    pos,
    indices: huecos.map((h, i) => (h === pos ? i : -1)).filter((i) => i >= 0),
  }));
  const mediaOnce = p.once.filter(Boolean).reduce((a, id, k, arr) => a + (porId.get(id!)?.media ?? 0) / arr.length, 0);

  return (
    <form action={accion} className="grid gap-5 xl:grid-cols-12">
      <input type="hidden" name="planteamiento" value={JSON.stringify(p)} />

      {/* Campo */}
      <section className="min-w-0 rounded-2xl border border-borde bg-superficie p-4 sm:p-5 xl:col-span-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(FORMACIONES) as Formacion[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => cambiarFormacion(f)}
                aria-pressed={p.formacion === f}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${p.formacion === f ? "bg-cesped text-white dark:text-black" : "border border-borde hover:bg-fondo"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => automatica(p.formacion)} className="text-sm font-semibold text-cesped hover:underline">
            Alineación automática
          </button>
        </div>
        <p className="mb-3 text-sm text-suave">
          {DESCRIPCION_FORMACION[p.formacion]} Media del once: <strong className="text-texto">{coma(mediaOnce)}</strong>
        </p>
        <div
          className="space-y-3 rounded-xl p-3 sm:p-5"
          style={{ background: "repeating-linear-gradient(180deg, #2f7d45 0 48px, #2b7340 48px 96px)" }}
        >
          {lineas.map((l) => (
            <div key={l.pos} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${l.indices.length}, minmax(0, 1fr))` }}>
              {l.indices.map((i) => {
                const id = p.once[i];
                const j = id ? porId.get(id) : undefined;
                const penaliza = j && factorPosicion(j.posicion, huecos[i]) < 1;
                return (
                  <label key={i} className={`block rounded-lg bg-white/95 p-1.5 text-center text-black shadow-sm ${penaliza || (j && j.lesion > 0) ? "ring-2 ring-amber-400" : ""}`}>
                    <span className="block text-[10px] font-bold tracking-wide text-black/50 uppercase">{NOMBRE_PUESTO[huecos[i]]}</span>
                    <select
                      value={id ?? ""}
                      onChange={(e) => ponerEnPuesto(i, e.target.value)}
                      className="mt-0.5 w-full truncate bg-transparent text-center text-xs font-semibold outline-none sm:text-sm"
                      aria-label={`${NOMBRE_PUESTO[huecos[i]]} ${i + 1}`}
                    >
                      <option value="">— Vacío —</option>
                      {jugadores.map((x) => (
                        <option key={x.id} value={x.id} disabled={x.lesion > 0}>
                          {etiqueta(x, huecos[i])}
                          {usados.has(x.id) && x.id !== id ? " (convocado)" : ""}
                        </option>
                      ))}
                    </select>
                    {j ? (
                      <span className="block text-[11px] text-black/60 tabular-nums">
                        Media {coma(j.media)} · energía {Math.round(100 - j.cansancio * 100)} %
                        {penaliza ? ` · fuera de sitio: rinde al ${Math.round(factorPosicion(j.posicion, huecos[i]) * 100)} %` : ""}
                        {j.lesion > 0 ? " · lesionado" : ""}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <div className="grid content-start gap-5 xl:col-span-5">
        {/* Táctica */}
        <section className="space-y-4 rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="font-semibold">Táctica</h2>
          <Segmentos nombre="Mentalidad" valor={p.mentalidad} opciones={MENTALIDADES} onChange={(v) => setP((x) => ({ ...x, mentalidad: v }))} />
          <Segmentos nombre="Presión" valor={p.presion} opciones={PRESIONES} onChange={(v) => setP((x) => ({ ...x, presion: v }))} />
        </section>

        {/* Banquillo */}
        <section className="rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="font-semibold">Banquillo</h2>
          <p className="mt-1 text-xs text-suave">Hasta {MAX_BANQUILLO} suplentes. El segundo entrenador hace cambios por cansancio a partir del 65&apos;.</p>
          <div className="mt-3 grid gap-2">
            {Array.from({ length: Math.min(MAX_BANQUILLO, p.banquillo.length + 1) }, (_, i) => (
              <select
                key={i}
                value={p.banquillo[i] ?? ""}
                onChange={(e) => ponerEnBanquillo(i, e.target.value)}
                className="w-full rounded-lg border border-borde bg-fondo px-2 py-2 text-sm"
                aria-label={`Suplente ${i + 1}`}
              >
                <option value="">{p.banquillo[i] ? "— Quitar —" : "+ Añadir suplente"}</option>
                {jugadores
                  .filter((x) => !p.once.includes(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id} disabled={x.lesion > 0}>
                      {etiqueta(x)}
                    </option>
                  ))}
              </select>
            ))}
          </div>
        </section>

        {/* Condicionales */}
        <section className="rounded-2xl border border-borde bg-superficie p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Instrucciones condicionales</h2>
            {p.condicionales.length < MAX_CONDICIONALES ? (
              <button
                type="button"
                className="text-sm font-semibold text-cesped hover:underline"
                onClick={() =>
                  setP((x) => ({
                    ...x,
                    condicionales: [...x.condicionales, { id: crypto.randomUUID(), desdeMinuto: 60, marcador: "perdiendo", accion: { mentalidad: "ofensiva" } }],
                  }))
                }
              >
                + Añadir
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-suave">Se aplican solas en la siguiente interrupción del juego, aunque no estés mirando.</p>
          <ul className="mt-3 space-y-3">
            {p.condicionales.map((c, i) => (
              <li key={c.id} className="rounded-xl bg-fondo p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>Desde el</span>
                  <select value={c.desdeMinuto} onChange={(e) => cambiarCondicional(i, { desdeMinuto: Number(e.target.value) })} className="rounded border border-borde bg-superficie px-1 py-0.5">
                    {[30, 45, 60, 70, 75, 80, 85].map((m) => (
                      <option key={m} value={m}>
                        {m}&apos;
                      </option>
                    ))}
                  </select>
                  <span>si vamos</span>
                  <select value={c.marcador} onChange={(e) => cambiarCondicional(i, { marcador: e.target.value as Condicional["marcador"] })} className="rounded border border-borde bg-superficie px-1 py-0.5">
                    <option value="perdiendo">perdiendo</option>
                    <option value="empatando">empatando</option>
                    <option value="ganando">ganando</option>
                  </select>
                  <button type="button" onClick={() => setP((x) => ({ ...x, condicionales: x.condicionales.filter((_, j) => j !== i) }))} className="ml-auto text-xs text-rival hover:underline">
                    Quitar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span>→</span>
                  <select
                    value={c.accion.mentalidad ?? ""}
                    onChange={(e) => cambiarCondicional(i, { accion: { mentalidad: (e.target.value || undefined) as Mentalidad | undefined } })}
                    className="rounded border border-borde bg-superficie px-1 py-0.5"
                  >
                    <option value="">mentalidad igual</option>
                    <option value="defensiva">defensiva</option>
                    <option value="equilibrada">equilibrada</option>
                    <option value="ofensiva">ofensiva</option>
                  </select>
                  <select
                    value={c.accion.presion ?? ""}
                    onChange={(e) => cambiarCondicional(i, { accion: { presion: (e.target.value || undefined) as Presion | undefined } })}
                    className="rounded border border-borde bg-superficie px-1 py-0.5"
                  >
                    <option value="">presión igual</option>
                    <option value="baja">presión baja</option>
                    <option value="normal">presión normal</option>
                    <option value="alta">presión alta</option>
                  </select>
                  <select
                    value={c.accion.cambio ? `${c.accion.cambio.salePosicion}-${c.accion.cambio.entraPosicion}` : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      cambiarCondicional(i, {
                        accion: { cambio: v ? { salePosicion: v.split("-")[0] as Posicion, entraPosicion: v.split("-")[1] as Posicion } : undefined },
                      });
                    }}
                    className="rounded border border-borde bg-superficie px-1 py-0.5"
                  >
                    <option value="">sin cambio</option>
                    <option value="DEF-DEL">defensa por delantero</option>
                    <option value="MED-DEL">medio por delantero</option>
                    <option value="DEL-DEF">delantero por defensa</option>
                    <option value="DEL-MED">delantero por medio</option>
                    <option value="MED-MED">medio por medio (refresco)</option>
                  </select>
                </div>
              </li>
            ))}
            {p.condicionales.length === 0 ? <li className="text-sm text-suave">Ninguna. Ejemplo: desde el 60&apos;, si vamos perdiendo, ofensiva y un delantero más.</li> : null}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={guardando} className="rounded-full bg-cesped px-5 py-2.5 font-semibold text-white disabled:opacity-60 dark:text-black">
            {guardando ? "Guardando…" : "Guardar alineación"}
          </button>
          {estado.ok ? <span className="text-sm font-medium text-cesped">{estado.ok}</span> : null}
          {estado.error ? <span className="text-sm font-medium text-rival">{estado.error}</span> : null}
        </div>
      </div>
    </form>
  );
}
