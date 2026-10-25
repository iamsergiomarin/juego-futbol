import Link from "next/link";
import { Escudo } from "@/componentes/Escudo";
import { formatoDiaLargo, formatoEuros, formatoFechaHora, formatoSigno } from "@/componentes/formato";
import { Aviso } from "@/componentes/juego/Aviso";
import { BotonesJornada } from "@/componentes/juego/BotonesJornada";
import { Caja } from "@/componentes/juego/Caja";
import { TablaClasificacion } from "@/componentes/juego/Clasificacion";
import { Novedades } from "@/componentes/juego/Novedades";
import { PartidosDelClub } from "@/componentes/juego/Partidos";
import { bdLocal } from "@/servidor/bd";
import {
  cabeceraClub,
  clasificacion,
  estadoTemporada,
  jornadasPendientes,
  managerLocal,
  partidosClub,
  resumenEconomia,
} from "@/servidor/consultas";
import { ultimasNoticias } from "@/servidor/noticias";
import { jugadoresEstado, planteamientoClub } from "@/servidor/plantilla";
import { resumenTemporada } from "@/servidor/temporada";
import { empezarTemporada } from "../acciones";

export const dynamic = "force-dynamic";

const NOMBRE_DESENLACE = {
  campeon: ["¡Campeones del grupo!", "Ascenso directo a la siguiente división."],
  ascenso: ["¡Ascenso por el playoff!", "Ganamos la final y el cruce. Subimos de categoría."],
  playoff: ["Se escapó en el playoff", "Nos quedamos a las puertas. La próxima temporada, otra vez."],
  permanencia: ["Temporada terminada", "Seguimos en la categoría. Toca preparar la siguiente."],
  descenso: ["Descenso", "Bajamos de categoría. Hay que reconstruir."],
} as const;

export default async function Inicio({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const manager = (await managerLocal())!;
  const club = (await cabeceraClub(manager.clubId))!;
  const bd = await bdLocal();
  const [temporada, tabla, jugados, pendientes, economia, noticias, resumen, quedan, jugadores] = await Promise.all([
    estadoTemporada(),
    clasificacion(club.grupoId),
    partidosClub(club.id, "jugados", 5),
    partidosClub(club.id, "pendientes", 6),
    resumenEconomia(club.id),
    ultimasNoticias(bd, club.id, 8),
    resumenTemporada(club.id),
    jornadasPendientes(),
    jugadoresEstado(bd, club.id),
  ]);
  const planteamiento = await planteamientoClub(bd, club.id, jugadores);
  const [proximo, ...siguientes] = pendientes;
  const mia = tabla.find((f) => f.id === club.id);
  const bajas = jugadores.filter((j) => j.jornadasLesion > 0).length;
  const cansados = jugadores.filter((j) => planteamiento.once.includes(j.id) && j.cansancio >= 0.35).length;

  return (
    <>
      <Aviso ok={q.ok} error={q.error} />
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Próximo partido o cierre de temporada */}
        <section className="rounded-2xl border border-borde bg-superficie p-5 sm:p-6 lg:col-span-8">
          {proximo ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold tracking-widest text-suave uppercase">
                  Próximo partido · {proximo.competicion === "playoff" ? `Playoff de ascenso · ${proximo.ronda}` : `Jornada ${proximo.jornada} de ${temporada?.total}`}
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
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{planteamiento.formacion}</span>
                  <span className="text-suave">
                    {" "}
                    · mentalidad {planteamiento.mentalidad} · presión {planteamiento.presion}
                    {planteamiento.condicionales.length > 0 ? ` · ${planteamiento.condicionales.length} condicional${planteamiento.condicionales.length > 1 ? "es" : ""}` : ""}
                  </span>
                  {bajas > 0 ? <span className="ml-2 font-semibold text-rival">✚ {bajas} de baja</span> : null}
                  {cansados > 0 ? <span className="ml-2 font-semibold text-amber-600">{cansados} titular{cansados > 1 ? "es" : ""} con poca energía</span> : null}
                </span>
                <Link href="/equipo/alineacion" className="font-semibold text-cesped hover:underline">
                  Cambiar alineación
                </Link>
              </div>
              <div className="mt-5 flex justify-end border-t border-borde pt-4">
                <BotonesJornada restantes={quedan} />
              </div>
            </>
          ) : resumen?.fase === "terminada" && resumen.desenlace ? (
            <div className="flex h-full flex-col justify-center gap-2 py-4 text-center">
              <p className="text-xs font-semibold tracking-widest text-suave uppercase">
                Temporada {resumen.numero} · {resumen.posicion}.º con {resumen.puntos} puntos
              </p>
              <p className="text-3xl font-bold">{NOMBRE_DESENLACE[resumen.desenlace][0]}</p>
              <p className="text-suave">{NOMBRE_DESENLACE[resumen.desenlace][1]}</p>
              {resumen.playoff.length > 0 ? (
                <ul className="mx-auto mt-3 space-y-1 text-sm">
                  {resumen.playoff.map((p) => (
                    <li key={p.id}>
                      <span className="text-suave">{p.ronda}:</span> {p.local} {p.golesLocal}-{p.golesVisitante} {p.visitante}
                      {p.golesLocal === p.golesVisitante ? <span className="text-suave"> (penaltis: {p.ganador})</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <form action={empezarTemporada} className="mt-4">
                <button type="submit" className="rounded-full bg-cesped px-6 py-3 font-semibold text-white dark:text-black">
                  Empezar la temporada {resumen.numero + 1}
                </button>
              </form>
              <p className="mt-1 text-xs text-suave">
                Antes, revisa los contratos que terminan: quien no renueve se irá libre. La ventana de fichajes está abierta.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center gap-3 py-6 text-center">
              <p className="text-xs font-semibold tracking-widest text-suave uppercase">Playoff de ascenso</p>
              <p className="text-2xl font-bold">El playoff sigue sin nosotros</p>
              <ul className="mx-auto space-y-1 text-sm">
                {resumen?.playoff.map((p) => (
                  <li key={p.id}>
                    <span className="text-suave">{p.ronda}:</span> {p.local} {p.golesLocal ?? ""}
                    {p.golesLocal != null ? "-" : " vs "}
                    {p.golesVisitante ?? ""} {p.visitante}
                  </li>
                ))}
              </ul>
              <div className="mx-auto">
                <BotonesJornada restantes={quedan} />
              </div>
            </div>
          )}
        </section>

        {/* Economía */}
        <Caja titulo="Economía" className="lg:col-span-4" enlace={{ href: "/club/economia", texto: "Detalle" }}>
          <p className="text-xs text-suave">En caja</p>
          <p className="text-3xl font-bold tabular-nums">{formatoEuros(economia.caja)}</p>
          {economia.ultimaJornada ? (
            <p className={`mt-1 text-sm font-semibold ${economia.ultimaJornada.neto >= 0 ? "text-cesped" : "text-rival"}`}>
              {formatoSigno(economia.ultimaJornada.neto)} en la jornada {economia.ultimaJornada.jornada}
            </p>
          ) : (
            <p className="mt-1 text-sm text-suave">Sin movimientos de jornada todavía: la taquilla llega con el primer partido en casa y los salarios se pagan cada sábado.</p>
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
          className="lg:col-span-7 lg:row-span-2"
          sinRelleno
        >
          <TablaClasificacion filas={tabla} propio={club.id} compacta conDescenso={club.division !== "Quinta"} />
        </Caja>

        {/* Novedades */}
        <Caja titulo="Novedades del cuerpo técnico" className="lg:col-span-5">
          <Novedades noticias={noticias} />
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
    </>
  );
}
