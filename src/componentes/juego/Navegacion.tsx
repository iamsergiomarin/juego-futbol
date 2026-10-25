"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Escudo } from "@/componentes/Escudo";

const SECCIONES = [
  { href: "/inicio", etiqueta: "Inicio", prefijos: ["/inicio"] },
  { href: "/club", etiqueta: "Club", prefijos: ["/club"] },
  { href: "/equipo", etiqueta: "Equipo", prefijos: ["/equipo", "/jugador"] },
  { href: "/competicion", etiqueta: "Competición", prefijos: ["/competicion", "/partido"] },
];

export function Navegacion({
  club,
  temporada,
}: {
  club: { nombre: string; corto: string; colorPrincipal: string; colorSecundario: string; division: string; grupo: number };
  temporada: { numero: number; jugadas: number; total: number } | null;
}) {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/inicio" className="flex min-w-0 shrink-0 items-center gap-2.5">
          <Escudo principal={club.colorPrincipal} secundario={club.colorSecundario} texto={club.corto} tamano={30} />
          <span className="hidden min-w-0 leading-tight md:block">
            <span className="block truncate text-sm font-semibold">{club.nombre}</span>
            <span className="block text-xs text-suave">
              {club.division} · Grupo {club.grupo}
            </span>
          </span>
        </Link>

        <nav aria-label="Secciones" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 md:justify-center">
          {SECCIONES.map((s) => {
            const activa = s.prefijos.some((p) => ruta === p || ruta.startsWith(`${p}/`));
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors " +
                  (activa ? "bg-cesped text-white dark:text-black" : "text-suave hover:bg-fondo hover:text-texto")
                }
              >
                {s.etiqueta}
              </Link>
            );
          })}
        </nav>

        {temporada ? (
          <div className="hidden shrink-0 text-right text-xs leading-tight text-suave lg:block">
            <span className="block font-semibold text-texto">Temporada {temporada.numero}</span>
            Jornada {Math.min(temporada.jugadas + 1, temporada.total)} de {temporada.total}
          </div>
        ) : null}
      </div>
    </header>
  );
}
