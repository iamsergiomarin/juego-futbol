import Link from "next/link";
import { Escudo } from "@/componentes/Escudo";
import { formatoDiaLargo, formatoEuros, formatoFechaHora, formatoSigno } from "@/componentes/formato";
import { BotonesJornada } from "@/componentes/juego/BotonesJornada";
import { Caja } from "@/componentes/juego/Caja";
import { TablaClasificacion } from "@/componentes/juego/Clasificacion";
import { PartidosDelClub } from "@/componentes/juego/Partidos";
import {
  cabeceraClub,
  clasificacion,
  estadoTemporada,
  managerLocal,
  partidosClub,
  resumenEconomia,
} from "@/servidor/consultas";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const manager = (await managerLocal())!;
  const club = (await cabeceraClub(manager.clubId))!;
  const [temporada, tabla, jugados, pendientes, economia] = await Promise.all([
    estadoTemporada(),
    clasificacion(club.grupoId),
    partidosClub(club.id, "jugados", 5),
    partidosClub(club.id, "pendientes", 6),
    resumenEconomia(club.id),
  ]);
  const [proximo, ...siguientes] = pendientes;
  const restantes = (temporada?.total ?? 0) - (temporada?.jugadas ?? 0);
  const mia = tabla.find((f) => f.id === club.id);

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Próximo partido */}
      <section className="rounded-2xl border border-borde bg-superficie p-5 sm:p-6 lg:col-span-8">
        {proximo ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold tracking-widest text-suave uppercase">
                Próximo partido · Jornada {proximo.jornada} de {temporada?.total}
              </p>
              <p className="text-sm text-suave first-letter:uppercase">{formatoFechaHora(proximo.inicio)}</p>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {[proximo.local, null, proximo.visitante].map((eq, i) =>
                eq ? (
                  <div key={eq.id} className="flex flex-col items-center gap-2 text-center">
                    <Escudo principal={eq.colorPrincipal} secundario={eq.colorSecundario} texto={eq.corto} tamano={64} titulo={eq.nombre} />
                    <span className={`leading-tight ${eq.id === club.id ? "font-bold" : "font-semibold"}`}>{eq.nombre}</span>
                    <span className="text-xs text-suave">{i === 0 ? "Local" : "Visitante"}</span>
                  </div>
                ) : (
                  <span key="vs" className="text-2xl font-bold text-suave">
                    vs
                  </span>
                ),
              )}
            </div>
            {mia && mia.jugados > 0 ? (
              <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-fondo p-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-suave">Posición</dt>
                  <dd className="text-lg font-bold">{mia.posicion}.º</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Puntos</dt>
                  <dd className="text-lg font-bold tabular-nums">{mia.puntos}</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Balance</dt>
                  <dd className="text-lg font-bold tabular-nums">
                    {mia.ganados}-{mia.empatados}-{mia.perdidos}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Goles</dt>
                  <dd className="text-lg font-bold tabular-nums">
                    {mia.golesFavor} : {mia.golesContra}
                  </dd>
                </div>
              </dl>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
              <p className="text-sm text-suave">
                Tu segundo entrenador alinea a los mejores en un 4-4-2. La alineación y la táctica llegan pronto.
              </p>
              <BotonesJornada restantes={restantes} />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center gap-2 py-6 text-center">
            <p className="text-xs font-semibold tracking-widest text-suave uppercase">Temporada {temporada?.numero} terminada</p>
            <p className="text-3xl font-bold">{mia ? `${mia.posicion}.º con ${mia.puntos} puntos` : "Fin de la liga"}</p>
            <p className="text-suave">
              {mia?.posicion === 1
                ? "Campeón del grupo: ascenso directo."
                : mia && mia.posicion <= 5
                  ? "Puesto de playoff de ascenso."
                  : "Los playoffs, ascensos y la nueva temporada llegan en la próxima versión."}
            </p>
            <Link href="/competicion" className="mx-auto mt-2 text-sm font-semibold text-cesped hover:underline">
              Ver la clasificación final
            </Link>
          </div>
        )}
      </section>

      {/* Economía */}
      <Caja titulo="Economía" className="lg:col-span-4" extra={<span className="text-xs text-suave">Temporada {temporada?.numero}</span>}>
        <p className="text-xs text-suave">En caja</p>
        <p className="text-3xl font-bold tabular-nums">{formatoEuros(economia.caja)}</p>
        {economia.ultimaJornada ? (
          <p className={`mt-1 text-sm font-semibold ${economia.ultimaJornada.neto >= 0 ? "text-cesped" : "text-rival"}`}>
            {formatoSigno(economia.ultimaJornada.neto)} en la jornada {economia.ultimaJornada.jornada}
          </p>
        ) : (
          <p className="mt-1 text-sm text-suave">Sin movimientos todavía: la taquilla llega con el primer partido en casa y los salarios se pagan cada sábado.</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-borde pt-4 text-sm">
          <div>
            <dt className="text-xs text-suave">Ingresos</dt>
            <dd className="font-semibold text-cesped tabular-nums">{formatoEuros(economia.ingresos)}</dd>
          </div>
          <div>
            <dt className="text-xs text-suave">Gastos</dt>
            <dd className="font-semibold text-rival tabular-nums">{formatoEuros(Math.abs(economia.gastos))}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-suave">Masa salarial (por temporada)</dt>
            <dd className="font-semibold tabular-nums">{formatoEuros(economia.masaSalarial)}</dd>
          </div>
        </dl>
        {economia.porConcepto.length > 0 ? (
          <ul className="mt-4 space-y-1.5 border-t border-borde pt-4 text-sm">
            {economia.porConcepto.slice(0, 5).map((c) => (
              <li key={c.concepto} className="flex justify-between gap-3">
                <span className="truncate text-suave">{c.concepto}</span>
                <span className={`tabular-nums ${c.importe >= 0 ? "" : "text-rival"}`}>{formatoSigno(c.importe)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Caja>

      {/* Clasificación */}
      <Caja
        titulo={`Clasificación · ${club.division}, grupo ${club.grupo}`}
        enlace={{ href: "/competicion", texto: "Completa" }}
        className="lg:col-span-7"
        sinRelleno
      >
        <TablaClasificacion filas={tabla} propio={club.id} compacta conDescenso={club.division !== "Quinta"} />
      </Caja>

      {/* Últimos y próximos */}
      <div className="grid gap-5 lg:col-span-5">
        <Caja titulo="Últimos partidos" enlace={{ href: "/competicion/calendario", texto: "Calendario" }}>
          <PartidosDelClub partidos={jugados} clubId={club.id} vacio="Todavía no se ha jugado ninguna jornada." />
        </Caja>
        <Caja titulo="Próximos partidos">
          <PartidosDelClub partidos={siguientes} clubId={club.id} vacio="No quedan partidos esta temporada." />
          {temporada?.proximaFecha && proximo ? (
            <p className="mt-3 text-xs text-suave first-letter:uppercase">Siguiente cita: {formatoDiaLargo(temporada.proximaFecha)}</p>
          ) : null}
        </Caja>
      </div>
    </div>
  );
}
