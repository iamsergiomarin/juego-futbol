import { formatoEuros } from "@/componentes/formato";
import { Aviso } from "@/componentes/juego/Aviso";
import { Caja } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { ESPACIOS_PATROCINIO, PATROCINIO, PERFILES_PATROCINIO, type EspacioPatrocinio } from "@/dominio/reglas";
import { responderOferta } from "../../acciones";
import { managerLocal } from "@/servidor/consultas";
import { contratosActivos, ofertasPendientes } from "@/servidor/patrocinio";
import { PESTANAS_CLUB } from "../pestanas";

export const dynamic = "force-dynamic";

const EFECTO: Record<string, string> = {
  local: "Sube la popularidad cada temporada.",
  multinacional: "Neutra para la afición.",
  apuestas: "Paga más que nadie, pero resta popularidad mientras dure.",
};

export default async function Patrocinio({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const manager = (await managerLocal())!;
  const [ofertas, contratos] = await Promise.all([ofertasPendientes(manager.clubId), contratosActivos(manager.clubId)]);
  const espacios = Object.keys(ESPACIOS_PATROCINIO) as EspacioPatrocinio[];

  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <Aviso ok={q.ok} error={q.error} />
      <p className="mb-5 max-w-3xl text-sm text-suave">
        El frontal de la camiseta y la marca deportiva son los dos grandes contratos del club. Sin contrato, el hueco rinde solo un {Math.round(PATROCINIO.sinContrato * 100)} % de lo que pagaría una marca normal. Las marcas son
        ficticias; cada una contraoferta se puede intentar una sola vez, y si te pasas, la marca se retira.
      </p>

      <div className="grid gap-5 xl:grid-cols-2">
        {espacios.map((e) => {
          const contrato = contratos.find((c) => c.espacio === e);
          const lista = ofertas.filter((o) => o.espacio === e);
          return (
            <Caja key={e} titulo={ESPACIOS_PATROCINIO[e].nombre}>
              {contrato ? (
                <div className="rounded-xl border border-borde p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold">{contrato.marca}</h3>
                    <span className="text-lg font-bold tabular-nums">{formatoEuros(contrato.fijo)}</span>
                  </div>
                  <p className="text-sm text-suave">
                    {PERFILES_PATROCINIO[contrato.perfil].nombre} · temporadas {contrato.desde}-{contrato.hasta} · por temporada
                  </p>
                  <p className="mt-3 text-sm">
                    Prima de {formatoEuros(contrato.prima)} si el equipo acaba entre los {contrato.objetivoPosicion} primeros.
                  </p>
                  <p className="mt-1 text-xs text-suave">{EFECTO[contrato.perfil]}</p>
                  <p className="mt-3 text-xs text-suave">Satisfacción del patrocinador</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fondo">
                    <div className={`h-full ${contrato.satisfaccion >= PATROCINIO.satisfaccionRenueva ? "bg-cesped" : contrato.satisfaccion > PATROCINIO.satisfaccionSeMarcha ? "bg-suave" : "bg-rival"}`} style={{ width: `${contrato.satisfaccion}%` }} />
                  </div>
                </div>
              ) : lista.length === 0 ? (
                <p className="text-sm text-suave">Sin patrocinador y sin ofertas por ahora: las marcas vuelven a llamar en la próxima pretemporada.</p>
              ) : (
                <ul className="space-y-3">
                  {lista.map((o) => (
                    <li key={o.id} className="rounded-xl border border-borde p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold">
                          {o.marca}
                          {o.renovacion ? <span className="ml-2 rounded-full bg-cesped-suave px-2 py-0.5 text-xs font-semibold text-cesped">Renueva al alza</span> : null}
                        </h3>
                        <span className="font-bold tabular-nums">{formatoEuros(o.fijo)}</span>
                      </div>
                      <p className="text-sm text-suave">
                        {PERFILES_PATROCINIO[o.perfil].nombre} · {o.duracion} {o.duracion === 1 ? "temporada" : "temporadas"} · por temporada
                      </p>
                      <p className="mt-2 text-sm">
                        Prima de {formatoEuros(o.prima)} si el equipo acaba entre los {o.objetivoPosicion} primeros.
                      </p>
                      <p className="text-xs text-suave">{EFECTO[o.perfil]}</p>
                      <form action={responderOferta} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="oferta" value={o.id} />
                        <button name="accion" value="aceptar" className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white dark:text-black">
                          Aceptar
                        </button>
                        {!o.contraofertada
                          ? [8, 15].map((n) => (
                              <button key={n} name="accion" value={`contra${n}`} className="rounded-full border border-borde px-4 py-1.5 text-sm font-semibold">
                                Pedir +{n} %
                              </button>
                            ))
                          : null}
                        <button name="accion" value="rechazar" className="rounded-full px-4 py-1.5 text-sm text-suave hover:underline">
                          Rechazar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Caja>
          );
        })}
      </div>
    </>
  );
}
