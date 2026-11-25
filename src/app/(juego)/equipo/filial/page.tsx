import Link from "next/link";
import { COLOR_POSICION, formatoFechaHora, formatoMedia } from "@/componentes/formato";
import { Aviso } from "@/componentes/juego/Aviso";
import { Caja, Dato } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { MERCADO_LOCAL } from "@/dominio/mercado";
import { FILIAL } from "@/dominio/reglas";
import { managerLocal } from "@/servidor/consultas";
import { datosFilial } from "@/servidor/filial";
import { decidirJuvenil, gestionarFilial } from "../../acciones";
import { PESTANAS_EQUIPO } from "../pestanas";

export const dynamic = "force-dynamic";

export default async function Filial({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const manager = (await managerLocal())!;
  const { nivel, tabla, plantilla, sinFicha, partidos, fichasPrimerEquipo } = await datosFilial(manager.clubId);
  const proximo = partidos.find((p) => p.golesLocal === null);
  const jugados = partidos.filter((p) => p.golesLocal !== null).slice(-4).reverse();
  const posicion = tabla.findIndex((f) => f.propio) + 1;

  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS_EQUIPO} />
      <Aviso ok={q.ok} error={q.error} />
      {nivel < FILIAL.nivelEscuelaMinimo ? (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <h2 className="font-semibold">Sin filial propio</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-suave">
            El filial se desbloquea con la escuela de cantera. Mientras tanto, el club inscribe un equipo B que lleva el cuerpo técnico sin tu intervención. Construye la escuela en{" "}
            <Link href="/club/instalaciones" className="font-semibold text-cesped hover:underline">
              Instalaciones
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Dato etiqueta="Posición en la liga B" valor={posicion > 0 ? `${posicion}.º` : "—"} nota="Una vuelta, 19 jornadas en domingo" />
            <Dato etiqueta="Jugadores en el filial" valor={`${plantilla.length} de ${FILIAL.maximoPlantilla}`} nota="Si faltan, completa la zona" />
            <Dato etiqueta="Arriba sin ficha" valor={`${sinFicha.length} de ${FILIAL.maximoSinFicha}`} />
            <Dato etiqueta="Fichas del primer equipo" valor={`${fichasPrimerEquipo} de ${MERCADO_LOCAL.maximoPlantilla}`} />
          </div>
          <p className="mb-5 max-w-3xl text-sm text-suave">
            El filial se juega solo, sin directo: lo dirige su entrenador y el analista te manda el informe cada semana. Los menores de {FILIAL.edadSinFicha} años suben al primer equipo sin ocupar ficha; al
            décimo partido arriba, o al cumplir {FILIAL.edadSinFicha}, necesitan ficha. Quien juega con el filial se desarrolla más deprisa. Sin ascensos, copas ni Europa.
          </p>

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="grid gap-5 xl:col-span-7">
              <Caja titulo="Plantilla del filial" sinRelleno>
                {plantilla.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-suave">El filial no tiene jugadores propios: juega con jóvenes de la zona. Pasa juveniles desde la academia (a partir de {FILIAL.edadMinima} años).</p>
                ) : (
                  <ul className="divide-y divide-borde">
                    {plantilla.map((j) => (
                      <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div>
                          <p className="font-semibold">
                            <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${COLOR_POSICION[j.posicion]}`}>{j.posicion}</span>
                            {j.nombre} {j.apellido}
                          </p>
                          <p className="text-xs text-suave">
                            {j.edad} años · media {formatoMedia(j.media)} · {j.partidos} {j.partidos === 1 ? "partido" : "partidos"} con el filial
                          </p>
                        </div>
                        <form action={decidirJuvenil} className="flex gap-2">
                          <input type="hidden" name="juvenil" value={j.id} />
                          <input type="hidden" name="volver" value="filial" />
                          <button name="accion" value={j.sinFicha ? "sin_ficha" : "subir"} className="rounded-full bg-cesped px-3 py-1 text-xs font-semibold text-white dark:text-black">
                            {j.sinFicha ? "Subir sin ficha" : "Subir con ficha"}
                          </button>
                        </form>
                        <form action={gestionarFilial}>
                          <input type="hidden" name="id" value={j.id} />
                          <button name="accion" value="academia" className="text-xs text-suave hover:underline">
                            A la academia
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </Caja>

              {sinFicha.length > 0 ? (
                <Caja titulo="Del filial en el primer equipo" sinRelleno>
                  <ul className="divide-y divide-borde">
                    {sinFicha.map((j) => (
                      <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div>
                          <p className="font-semibold">{j.nombre}</p>
                          <p className="text-xs text-suave">
                            {j.edad} años · media {formatoMedia(j.media)} · {j.partidos} {j.partidos === 1 ? "partido" : "partidos"} arriba
                            {j.pide ? " · pide ficha" : ""}
                          </p>
                        </div>
                        <form action={gestionarFilial}>
                          <input type="hidden" name="id" value={j.id} />
                          <button name="accion" value="ficha" className="rounded-full border border-borde px-3 py-1 text-xs font-semibold">
                            Dar ficha
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <p className="px-5 pt-3 pb-4 text-xs text-suave">Al acabar la temporada, quien pide ficha la recibe si hay hueco; si no, el club no puede retenerlo y se marcha.</p>
                </Caja>
              ) : null}

              <Caja titulo="Partidos del filial">
                <ul className="space-y-2 text-sm">
                  {proximo ? (
                    <li className="rounded-xl bg-cesped-suave px-3 py-2">
                      Próximo, jornada {proximo.jornada} · {formatoFechaHora(proximo.fecha)}: <strong>{proximo.local}</strong> – <strong>{proximo.visitante}</strong>
                    </li>
                  ) : null}
                  {jugados.map((p) => (
                    <li key={p.jornada} className="flex justify-between gap-3">
                      <span className="text-suave">J{p.jornada}</span>
                      <span>
                        {p.local} <strong className="tabular-nums">{p.golesLocal}-{p.golesVisitante}</strong> {p.visitante}
                      </span>
                    </li>
                  ))}
                  {!proximo && jugados.length === 0 ? <li className="text-suave">Sin partidos todavía.</li> : null}
                </ul>
              </Caja>
            </div>

            <Caja titulo="Liga de filiales del grupo" sinRelleno className="xl:col-span-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-xs text-suave">
                    <th className="py-2 pr-1 pl-5 font-medium">#</th>
                    <th className="px-1 py-2 font-medium">Equipo</th>
                    <th className="px-1 py-2 text-right font-medium">PJ</th>
                    <th className="px-1 py-2 text-right font-medium">DG</th>
                    <th className="py-2 pr-5 pl-1 text-right font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.map((f, i) => (
                    <tr key={f.id} className={`border-b border-borde/60 last:border-0 ${f.propio ? "bg-cesped-suave/50 font-semibold" : ""}`}>
                      <td className="py-2 pr-1 pl-5 text-suave tabular-nums">{i + 1}</td>
                      <td className="px-1 py-2">{f.nombre} B</td>
                      <td className="px-1 py-2 text-right tabular-nums">{f.jugados}</td>
                      <td className="px-1 py-2 text-right tabular-nums">{f.golesFavor - f.golesContra}</td>
                      <td className="py-2 pr-5 pl-1 text-right font-bold tabular-nums">{f.puntos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Caja>
          </div>
        </>
      )}
    </>
  );
}
