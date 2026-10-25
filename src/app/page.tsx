import Link from "next/link";
import {
  crearRng,
  generarEquipo,
  mediaJugador,
  semillaAleatoria,
  simularPartido,
  type EquipoPartido,
  type EventoPartido,
} from "@/motor";
import { estadoBdLocal, modoLocal } from "@/servidor/bd";

export const dynamic = "force-dynamic";

async function EstadoLocal() {
  if (!modoLocal()) return null;
  const estado = await estadoBdLocal().then(
    (e) => ({ ok: true as const, tablas: e.tablas }),
    (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
  );
  if (!estado.ok) {
    return (
      <p className="mt-2 rounded-xl bg-rival-suave px-3 py-2 text-xs text-rival">
        No se pudo abrir la base de datos local: {estado.error}
      </p>
    );
  }
  return (
    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-cesped-suave px-3 py-1 text-xs text-cesped">
      <span className="h-2 w-2 rounded-full bg-cesped" aria-hidden />
      Modo local · base de datos lista ({estado.tablas} tablas)
    </p>
  );
}

function media(e: EquipoPartido): string {
  const m = e.titulares.reduce((a, j) => a + mediaJugador(j.atributos), 0) / e.titulares.length;
  return m.toFixed(1).replace(".", ",");
}

const ICONO: Record<EventoPartido["tipo"], string> = {
  gol: "⚽",
  ocasion: "•",
  cambio: "⇄",
  tactica: "✎",
  condicional: "↻",
  descanso: "◐",
  final: "■",
};

function Barra({ titulo, valores, formato }: { titulo: string; valores: [number, number]; formato?: (v: number) => string }) {
  const total = valores[0] + valores[1] || 1;
  const izquierda = (100 * valores[0]) / total;
  const f = formato ?? ((v: number) => String(v));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-semibold tabular-nums">{f(valores[0])}</span>
        <span className="text-suave">{titulo}</span>
        <span className="font-semibold tabular-nums">{f(valores[1])}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-rival-suave">
        <div className="bg-cesped" style={{ width: `${izquierda}%` }} />
        <div className="flex-1 bg-rival" />
      </div>
    </div>
  );
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ semilla?: string }> }) {
  const { semilla: semillaParam } = await searchParams;
  const parsed = Number(semillaParam);
  const semilla = Number.isInteger(parsed) && parsed >= 0 ? parsed : semillaAleatoria();

  const rng = crearRng(semilla);
  const local = generarEquipo(rng, "pis", "Atlético Pisuerga", 5.3);
  const visitante = generarEquipo(rng, "mes", "Real Meseta", 5.6);
  local.condicionales = [
    { id: "remontada", desdeMinuto: 60, marcador: "perdiendo", accion: { mentalidad: "ofensiva", cambio: { salePosicion: "DEF", entraPosicion: "DEL" } } },
  ];
  visitante.condicionales = [
    { id: "cerrojo", desdeMinuto: 75, marcador: "ganando", accion: { mentalidad: "defensiva", cambio: { salePosicion: "DEL", entraPosicion: "DEF" } } },
  ];
  const r = simularPartido(local, visitante, semilla);
  const eventos = r.eventos.filter((e) => e.tipo !== "final");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <p className="text-xs font-semibold tracking-widest text-suave uppercase">Prototipo del motor · Quinta división</p>
      <EstadoLocal />

      <section className="mt-4 rounded-2xl border border-borde bg-superficie p-5 sm:p-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div>
            <p className="font-semibold leading-tight sm:text-lg">{local.nombre}</p>
            <p className="mt-1 text-xs text-suave">Local · media {media(local)}</p>
          </div>
          <p className="text-4xl font-bold tabular-nums sm:text-5xl">
            {r.goles[0]}<span className="mx-2 text-suave">-</span>{r.goles[1]}
          </p>
          <div>
            <p className="font-semibold leading-tight sm:text-lg">{visitante.nombre}</p>
            <p className="mt-1 text-xs text-suave">Visitante · media {media(visitante)}</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <Barra titulo="Posesión" valores={r.posesion} formato={(v) => `${v} %`} />
          <Barra titulo="Tiros" valores={r.tiros} />
          <Barra titulo="Goles esperados (xG)" valores={r.xg} formato={(v) => v.toFixed(2).replace(".", ",")} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-borde bg-superficie p-5 sm:p-8">
        <h2 className="font-semibold">Minuto a minuto</h2>
        <ol className="mt-4 space-y-3">
          {eventos.map((e, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-suave">{e.minuto}&apos;</span>
              <span
                className={
                  "w-5 shrink-0 text-center " +
                  (e.lado === "local" ? "text-cesped" : e.lado === "visitante" ? "text-rival" : "text-suave")
                }
                aria-hidden
              >
                {ICONO[e.tipo]}
              </span>
              <span className={e.tipo === "gol" ? "font-semibold" : ""}>{e.texto}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-suave">
        <span>Semilla {r.semilla}: el mismo número reproduce el mismo partido.</span>
        <Link href="/" className="rounded-full bg-cesped px-4 py-2 font-semibold text-white dark:text-black">
          Jugar otro partido
        </Link>
      </div>
    </main>
  );
}
