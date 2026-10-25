import Link from "next/link";
import { formatoDiaLargo } from "@/componentes/formato";
import { Caja } from "@/componentes/juego/Caja";
import { PartidosJornada } from "@/componentes/juego/Partidos";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { cabeceraClub, estadoTemporada, managerLocal, partidosJornada } from "@/servidor/consultas";
import { PESTANAS_COMPETICION } from "../pestanas";

export const dynamic = "force-dynamic";

export default async function Calendario({ searchParams }: { searchParams: Promise<{ jornada?: string }> }) {
  const manager = (await managerLocal())!;
  const club = (await cabeceraClub(manager.clubId))!;
  const temporada = await estadoTemporada();
  const total = temporada?.total ?? 38;
  const pedida = Number((await searchParams).jornada);
  // Por defecto, la última jornada jugada (o la primera si aún no ha empezado).
  const jornada = Number.isInteger(pedida) && pedida >= 1 && pedida <= total ? pedida : Math.max(1, temporada?.jugadas ?? 1);
  const partidos = await partidosJornada(club.grupoId, jornada);
  const enlace = (j: number) => `/competicion/calendario?jornada=${j}`;

  return (
    <>
      <Pestanas titulo="Competición" pestanas={PESTANAS_COMPETICION} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Caja
          titulo={`Jornada ${jornada}`}
          extra={
            <span className="flex items-center gap-1">
              {jornada > 1 ? (
                <Link href={enlace(jornada - 1)} className="rounded-full border border-borde px-3 py-1 text-sm hover:bg-fondo" aria-label="Jornada anterior">
                  ←
                </Link>
              ) : null}
              {jornada < total ? (
                <Link href={enlace(jornada + 1)} className="rounded-full border border-borde px-3 py-1 text-sm hover:bg-fondo" aria-label="Jornada siguiente">
                  →
                </Link>
              ) : null}
            </span>
          }
          className="xl:col-span-8"
          sinRelleno
        >
          {partidos[0] ? <p className="px-5 pb-2 text-sm text-suave first-letter:uppercase">{formatoDiaLargo(partidos[0].inicio)}</p> : null}
          <PartidosJornada partidos={partidos} resaltar={club.id} />
        </Caja>
        <Caja titulo="Todas las jornadas" className="xl:col-span-4">
          <ol className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 xl:grid-cols-6">
            {Array.from({ length: total }, (_, i) => i + 1).map((j) => {
              const jugada = j <= (temporada?.jugadas ?? 0);
              return (
                <li key={j}>
                  <Link
                    href={enlace(j)}
                    aria-current={j === jornada ? "page" : undefined}
                    className={
                      "grid h-9 place-items-center rounded-lg text-sm tabular-nums " +
                      (j === jornada
                        ? "bg-cesped font-bold text-white dark:text-black"
                        : jugada
                          ? "bg-cesped-suave text-cesped hover:ring-1 hover:ring-cesped"
                          : "border border-borde text-suave hover:bg-fondo")
                    }
                  >
                    {j}
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-suave">Jornadas impares en lunes y pares en sábado, a las 21:00.</p>
        </Caja>
      </div>
    </>
  );
}
