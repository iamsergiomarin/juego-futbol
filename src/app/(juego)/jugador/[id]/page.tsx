import Link from "next/link";
import { notFound } from "next/navigation";
import { COLOR_POSICION, formatoEuros, formatoMedia, NOMBRE_PERSONALIDAD, NOMBRE_POSICION } from "@/componentes/formato";
import { Aviso } from "@/componentes/juego/Aviso";
import { Caja, Dato } from "@/componentes/juego/Caja";
import { Baja, Energia, Forma } from "@/componentes/juego/EstadoJugador";
import { FAMILIAS, nombreAtributo } from "@/dominio/atributos";
import { NOMBRE_FOCO, type Foco } from "@/dominio/entrenamiento";
import { MERCADO } from "@/dominio/reglas";
import { managerLocal } from "@/servidor/consultas";
import { detalleJugador } from "@/servidor/jugador";
import { estadoMercado } from "@/servidor/mercado";
import { fichar, renovar, vender } from "../../acciones";

export const dynamic = "force-dynamic";

function Barra({ valor, rango }: { valor: number | null; rango: [number, number] | null }) {
  const centro = valor ?? (rango ? (rango[0] + rango[1]) / 2 : 0);
  const color = centro >= 60 ? "bg-cesped" : centro >= 40 ? "bg-amber-500" : "bg-rival";
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-fondo">
      {valor != null ? (
        <div className={`h-full ${color}`} style={{ width: `${valor}%` }} />
      ) : rango ? (
        <div className={`absolute h-full ${color} opacity-60`} style={{ left: `${rango[0]}%`, width: `${Math.max(2, rango[1] - rango[0])}%` }} />
      ) : null}
    </div>
  );
}

export default async function Jugador({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const manager = (await managerLocal())!;
  const j = await detalleJugador(id, manager.clubId);
  if (!j) notFound();
  const mercado = await estadoMercado(manager.clubId);
  const fichable = !j.propio && !j.retirado && (j.club === null || j.precioVenta != null);
  const termina = j.contratoHasta != null && j.contratoHasta <= j.temporadaActual;
  const familias = FAMILIAS.map((f) => ({ ...f, filas: j.atributos.filter((a) => (f.atributos as string[]).includes(a.clave)) })).filter((f) => f.filas.length > 0);

  return (
    <>
      <Aviso ok={q.ok} error={q.error} />
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-cesped-suave text-2xl font-bold text-cesped tabular-nums">{j.dorsal ?? "–"}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-widest text-suave uppercase">
            {j.club ? (j.propio ? "Tu plantilla" : j.club.nombre) : j.retirado ? "Retirado" : "Agente libre"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {j.nombre} {j.apellido}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-suave">
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${COLOR_POSICION[j.posicion]}`}>{NOMBRE_POSICION[j.posicion]}</span>
            {j.edad} años · {NOMBRE_PERSONALIDAD[j.personalidad] ?? j.personalidad}
            <Baja jornadas={j.jornadasLesion} tipo={j.tipoLesion} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-suave">{j.propio ? "Media" : "Media estimada"}</p>
          <p className="text-4xl font-bold tabular-nums">{j.mediaRango ? `${formatoMedia(j.mediaRango[0])}–${formatoMedia(j.mediaRango[1])}` : formatoMedia(j.media)}</p>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid content-start gap-5 xl:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Dato etiqueta="Potencial estimado" valor={j.potencialTexto} nota={j.propio ? "Según tu segundo entrenador" : "Según tu ojeador"} />
            <Dato etiqueta="Valor de mercado" valor={formatoEuros(j.valor)} />
            <Dato etiqueta="Salario" valor={formatoEuros(j.salario)} nota="por temporada" />
            <Dato
              etiqueta="Contrato"
              valor={j.contratoHasta ? (termina ? "Termina" : `Temp. ${j.contratoHasta}`) : "Sin contrato"}
              tono={termina && j.propio ? "negativo" : undefined}
            />
          </div>

          <Caja titulo="Atributos" extra={j.propio ? undefined : <span className="text-xs text-suave">Rangos de tu ojeador</span>}>
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {familias.map((f) => (
                <div key={f.nombre}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-suave uppercase">{f.nombre}</h3>
                  <ul className="space-y-2">
                    {f.filas.map((a) => (
                      <li key={a.clave} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm">
                        <span>{nombreAtributo(a.clave)}</span>
                        <Barra valor={a.valor} rango={a.rango} />
                        <span className="text-right font-semibold tabular-nums">
                          {a.valor ?? `${a.rango![0]}–${a.rango![1]}`}
                          {j.propio && j.cambiosSemana[a.clave] ? (
                            <span className={`ml-1 text-xs ${j.cambiosSemana[a.clave] > 0 ? "text-cesped" : "text-rival"}`}>
                              {j.cambiosSemana[a.clave] > 0 ? "▲" : "▼"}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Caja>
        </div>

        <div className="grid content-start gap-5 xl:col-span-4">
          {j.propio ? (
            <Caja titulo="Estado">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-suave">Energía</dt>
                  <dd>
                    <Energia cansancio={j.cansancio} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Forma</dt>
                  <dd>
                    <Forma forma={j.forma} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Moral</dt>
                  <dd className="font-semibold tabular-nums">{j.moral} / 100</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Foco de entrenamiento</dt>
                  <dd className="font-semibold">{j.foco ? NOMBRE_FOCO[j.foco as Foco] : "Sin foco"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Partidos (liga)</dt>
                  <dd className="font-semibold tabular-nums">{j.partidos}</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Goles (liga)</dt>
                  <dd className="font-semibold tabular-nums">{j.goles}</dd>
                </div>
              </dl>
            </Caja>
          ) : null}

          {j.propio ? (
            <Caja titulo="Contrato">
              <p className="text-sm text-suave">
                Para renovar pide <strong className="text-texto">{formatoEuros(j.salarioPedido)}</strong> por temporada
                {j.salarioPedido > j.salario ? ` (ahora cobra ${formatoEuros(j.salario)})` : ""}.
                {termina ? " Su contrato termina esta temporada: si no renueva, se irá libre." : ""}
              </p>
              <form action={renovar} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="jugador" value={j.id} />
                <select name="temporadas" defaultValue="2" className="rounded-lg border border-borde bg-fondo px-2 py-1.5 text-sm" aria-label="Años de renovación">
                  <option value="1">+1 temporada</option>
                  <option value="2">+2 temporadas</option>
                  <option value="3">+3 temporadas</option>
                </select>
                <button type="submit" className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white dark:text-black">
                  Renovar
                </button>
              </form>
            </Caja>
          ) : null}

          {j.propio ? (
            <Caja titulo="Mercado">
              {j.precioVenta ? (
                <>
                  <p className="text-sm">
                    En venta por <strong>{formatoEuros(j.precioVenta)}</strong>.
                  </p>
                  <form action={vender} className="mt-3">
                    <input type="hidden" name="jugador" value={j.id} />
                    <input type="hidden" name="quitar" value="1" />
                    <button type="submit" className="rounded-full border border-borde px-4 py-1.5 text-sm font-semibold hover:bg-fondo">
                      Retirar del mercado
                    </button>
                  </form>
                </>
              ) : (
                <form action={vender} className="space-y-2">
                  <input type="hidden" name="jugador" value={j.id} />
                  <label className="block text-sm">
                    <span className="text-suave">Precio de venta (valor: {formatoEuros(j.valor)})</span>
                    <input
                      name="precio"
                      inputMode="numeric"
                      defaultValue={j.valor}
                      className="mt-1 w-full rounded-lg border border-borde bg-fondo px-3 py-2 tabular-nums"
                    />
                  </label>
                  <button type="submit" className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white dark:text-black">
                    Poner en venta
                  </button>
                  <p className="text-xs text-suave">Cerca de su valor se vende en pocas jornadas; muy por encima, nadie pagará.</p>
                </form>
              )}
            </Caja>
          ) : fichable ? (
            <Caja titulo="Fichar">
              <p className="text-sm text-suave">
                {j.club ? (
                  <>
                    {j.club.nombre} pide <strong className="text-texto">{formatoEuros(j.precioVenta!)}</strong> (más un{" "}
                    {Math.round(MERCADO.comisionFederacion * 1000) / 10} % de comisión).
                  </>
                ) : (
                  "Agente libre: sin traspaso, con prima de fichaje."
                )}{" "}
                Pide un salario de <strong className="text-texto">{formatoEuros(j.salarioPedido)}</strong>.
                {j.club && !mercado.ventana ? " La ventana de traspasos está cerrada." : ""}
              </p>
              <form action={fichar} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="jugador" value={j.id} />
                <input type="hidden" name="volver" value={`/jugador/${j.id}`} />
                <select name="temporadas" defaultValue="2" className="rounded-lg border border-borde bg-fondo px-2 py-1.5 text-sm" aria-label="Duración del contrato">
                  <option value="1">1 temporada</option>
                  <option value="2">2 temporadas</option>
                  <option value="3">3 temporadas</option>
                </select>
                <button
                  type="submit"
                  disabled={Boolean(j.club) && !mercado.ventana}
                  className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:text-black"
                >
                  Fichar
                </button>
              </form>
            </Caja>
          ) : null}

          <Link href={j.propio ? "/equipo" : "/equipo/mercado"} className="text-sm font-semibold text-cesped hover:underline">
            ← {j.propio ? "Volver a la plantilla" : "Volver al mercado"}
          </Link>
        </div>
      </div>
    </>
  );
}
