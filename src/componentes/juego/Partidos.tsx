import Link from "next/link";
import { Escudo } from "@/componentes/Escudo";
import { formatoFechaHora } from "@/componentes/formato";
import type { PartidoBreve } from "@/servidor/consultas";

function resultadoPara(p: PartidoBreve, clubId: string): "G" | "E" | "P" | null {
  if (p.golesLocal == null || p.golesVisitante == null) return null;
  const propio = p.local.id === clubId ? p.golesLocal : p.golesVisitante;
  const rival = p.local.id === clubId ? p.golesVisitante : p.golesLocal;
  return propio > rival ? "G" : propio === rival ? "E" : "P";
}

const COLOR = { G: "bg-cesped text-white dark:text-black", E: "bg-borde text-texto", P: "bg-rival text-white dark:text-black" };

/** Lista de partidos de un club, vista desde ese club (rival, campo y resultado). */
export function PartidosDelClub({ partidos, clubId, vacio }: { partidos: PartidoBreve[]; clubId: string; vacio: string }) {
  if (partidos.length === 0) return <p className="text-sm text-suave">{vacio}</p>;
  return (
    <ul className="-mx-2 divide-y divide-borde/60">
      {partidos.map((p) => {
        const enCasa = p.local.id === clubId;
        const rival = enCasa ? p.visitante : p.local;
        const r = resultadoPara(p, clubId);
        return (
          <li key={p.id}>
            <Link href={`/partido/${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-fondo">
              <span className="w-8 shrink-0 text-xs text-suave tabular-nums" title={p.ronda ?? undefined}>
                {p.competicion === "playoff" ? "PO" : `J${p.jornada}`}
              </span>
              <Escudo principal={rival.colorPrincipal} secundario={rival.colorSecundario} texto={rival.corto} tamano={22} titulo={rival.nombre} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{rival.nombre}</span>
                <span className="block text-xs text-suave">
                  {p.ronda ? `${p.ronda} · ` : ""}
                  {enCasa ? "En casa" : "Fuera"} · {formatoFechaHora(p.inicio)}
                </span>
              </span>
              {r ? (
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">
                    {p.golesLocal}-{p.golesVisitante}
                  </span>
                  <span className={`grid h-6 w-6 place-items-center rounded text-xs font-bold ${COLOR[r]}`}>{r}</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Partidos de una jornada completa (calendario). */
export function PartidosJornada({ partidos, resaltar }: { partidos: PartidoBreve[]; resaltar: string }) {
  return (
    <ul className="divide-y divide-borde/60">
      {partidos.map((p) => {
        const jugado = p.golesLocal != null;
        const mio = p.local.id === resaltar || p.visitante.id === resaltar;
        return (
          <li key={p.id}>
            <Link
              href={`/partido/${p.id}`}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 text-sm hover:bg-fondo ${mio ? "bg-cesped-suave font-semibold" : ""}`}
            >
              <span className="flex min-w-0 items-center justify-end gap-2 text-right">
                <span className="truncate">{p.local.nombre}</span>
                <Escudo principal={p.local.colorPrincipal} secundario={p.local.colorSecundario} texto={p.local.corto} tamano={22} titulo={p.local.nombre} />
              </span>
              <span className={`min-w-14 rounded-md px-2 py-1 text-center tabular-nums ${jugado ? "bg-fondo font-bold" : "text-xs text-suave"}`}>
                {jugado ? `${p.golesLocal} - ${p.golesVisitante}` : formatoFechaHora(p.inicio).split(" · ")[1]}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Escudo principal={p.visitante.colorPrincipal} secundario={p.visitante.colorSecundario} texto={p.visitante.corto} tamano={22} titulo={p.visitante.nombre} />
                <span className="truncate">{p.visitante.nombre}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
