"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Pestana {
  href: string;
  etiqueta: string;
  /** Aún no construida: se muestra para que se vea lo que viene. */
  proximamente?: boolean;
}

/** Subsecciones de una sección (Club, Equipo, Competición…). */
export function Pestanas({ titulo, pestanas }: { titulo: string; pestanas: Pestana[] }) {
  const ruta = usePathname();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-borde">
      <h1 className="pb-3 text-2xl font-bold tracking-tight">{titulo}</h1>
      <nav aria-label={`Apartados de ${titulo}`} className="-mb-px flex gap-1 overflow-x-auto">
        {pestanas.map((p) => {
          const activa = ruta === p.href;
          if (p.proximamente) {
            return (
              <span key={p.href} className="shrink-0 cursor-default border-b-2 border-transparent px-3 pb-3 text-sm text-suave/60" title="Próximamente">
                {p.etiqueta}
                <span className="ml-1.5 rounded bg-fondo px-1 py-0.5 text-[10px] font-semibold tracking-wide uppercase">Pronto</span>
              </span>
            );
          }
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={activa ? "page" : undefined}
              className={
                "shrink-0 border-b-2 px-3 pb-3 text-sm font-semibold transition-colors " +
                (activa ? "border-cesped text-texto" : "border-transparent text-suave hover:text-texto")
              }
            >
              {p.etiqueta}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
