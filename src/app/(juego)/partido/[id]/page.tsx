import Link from "next/link";
import { notFound } from "next/navigation";
import { Escudo } from "@/componentes/Escudo";
import { formatoEntero, formatoFechaHora } from "@/componentes/formato";
import { Caja } from "@/componentes/juego/Caja";
import { detallePartido } from "@/servidor/consultas";

export const dynamic = "force-dynamic";

const ICONO: Record<string, string> = { gol: "⚽", ocasion: "•", cambio: "⇄", tactica: "✎", condicional: "↻", descanso: "◐", final: "■" };

function Barra({ titulo, valores, formato }: { titulo: string; valores: [number, number]; formato?: (v: number) => string }) {
  const total = valores[0] + valores[1] || 1;
  const f = formato ?? ((v: number) => String(v));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-semibold tabular-nums">{f(valores[0])}</span>
        <span className="text-suave">{titulo}</span>
        <span className="font-semibold tabular-nums">{f(valores[1])}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-rival-suave">
        <div className="bg-cesped" style={{ width: `${(100 * valores[0]) / total}%` }} />
        <div className="flex-1 bg-rival" />
      </div>
    </div>
  );
}

export default async function Partido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await detallePartido(id);
  if (!p) notFound();
  const jugado = p.estado === "finalizado";
  const eventos = p.eventos.filter((e) => e.tipo !== "final");

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-12">
        <Link href={`/competicion/calendario?jornada=${p.jornada}`} className="text-sm font-semibold text-cesped hover:underline">
          ← Jornada {p.jornada}
        </Link>
      </div>
      <section className="rounded-2xl border border-borde bg-superficie p-5 sm:p-8 lg:col-span-12">
        <p className="text-center text-xs font-semibold tracking-widest text-suave uppercase">
          Liga · Jornada {p.jornada} · {formatoFechaHora(p.inicio)}
          {p.asistencia ? ` · ${formatoEntero(p.asistencia)} espectadores` : ""}
        </p>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
          {[p.local, p.visitante].map((eq, i) => (
            <div key={eq.id} className={`flex flex-col items-center gap-2 ${i === 1 ? "order-3" : ""}`}>
              <Escudo principal={eq.colorPrincipal} secundario={eq.colorSecundario} texto={eq.corto} tamano={72} titulo={eq.nombre} />
              <span className="font-semibold leading-tight sm:text-lg">{eq.nombre}</span>
            </div>
          ))}
          <p className="order-2 text-4xl font-bold tabular-nums sm:text-6xl">
            {jugado ? (
              <>
                {p.golesLocal}
                <span className="mx-2 text-suave">-</span>
                {p.golesVisitante}
              </>
            ) : (
              <span className="text-2xl text-suave">Por jugar</span>
            )}
          </p>
        </div>
        {p.estadisticas ? (
          <div className="mx-auto mt-8 max-w-3xl space-y-4">
            <Barra titulo="Posesión" valores={p.estadisticas.posesion} formato={(v) => `${v} %`} />
            <Barra titulo="Tiros" valores={p.estadisticas.tiros} />
            <Barra titulo="Goles esperados (xG)" valores={p.estadisticas.xg} formato={(v) => v.toFixed(2).replace(".", ",")} />
          </div>
        ) : null}
      </section>

      {jugado ? (
        <>
          <Caja titulo="Minuto a minuto" className="lg:col-span-7">
            <ol className="space-y-3">
              {eventos.map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-suave">{e.minuto}&apos;</span>
                  <span
                    aria-hidden
                    className={`w-5 shrink-0 text-center ${e.lado === "local" ? "text-cesped" : e.lado === "visitante" ? "text-rival" : "text-suave"}`}
                  >
                    {ICONO[e.tipo] ?? "•"}
                  </span>
                  <span className={e.tipo === "gol" ? "font-semibold" : ""}>{e.texto}</span>
                </li>
              ))}
            </ol>
          </Caja>
          <Caja titulo="Alineaciones" className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-5 text-sm">
              {([p.alineaciones.local, p.alineaciones.visitante] as const).map((a, i) => (
                <div key={i}>
                  <p className={`mb-2 font-semibold ${i === 0 ? "text-cesped" : "text-rival"}`}>{i === 0 ? p.local.nombre : p.visitante.nombre}</p>
                  <ol className="space-y-1">
                    {a.titulares.map((n) => (
                      <li key={n} className="truncate">
                        {n}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 mb-1 text-xs text-suave">Suplentes</p>
                  <ol className="space-y-1 text-suave">
                    {a.banquillo.map((n) => (
                      <li key={n} className="truncate">
                        {n}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-borde pt-3 text-xs text-suave">4-4-2 elegido por el segundo entrenador.</p>
          </Caja>
        </>
      ) : null}
    </div>
  );
}
