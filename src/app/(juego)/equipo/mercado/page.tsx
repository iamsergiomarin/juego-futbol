import Link from "next/link";
import { COLOR_POSICION, formatoEuros, formatoMedia } from "@/componentes/formato";
import { Aviso } from "@/componentes/juego/Aviso";
import { Dato } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import type { Posicion } from "@/motor";
import { MERCADO_LOCAL } from "@/dominio/mercado";
import { MERCADO } from "@/dominio/reglas";
import { bdLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { estadoMercado, ofertasMercado } from "@/servidor/mercado";
import { jugadoresEstado } from "@/servidor/plantilla";
import { fichar } from "../../acciones";
import { PESTANAS_EQUIPO } from "../pestanas";

export const dynamic = "force-dynamic";

const POSICIONES: Posicion[] = ["POR", "DEF", "MED", "DEL"];

export default async function Mercado({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; pos?: string; ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  const tipo = q.tipo === "libres" || q.tipo === "transferibles" ? q.tipo : undefined;
  const posicion = POSICIONES.includes(q.pos as Posicion) ? (q.pos as Posicion) : undefined;
  const manager = (await managerLocal())!;
  const bd = await bdLocal();
  const [estado, ofertas, mios] = await Promise.all([
    estadoMercado(manager.clubId),
    ofertasMercado(manager.clubId, { tipo, posicion }),
    jugadoresEstado(bd, manager.clubId),
  ]);
  const enVenta = mios.filter((j) => j.precioVenta);
  const enlace = (cambios: { tipo?: string | null; pos?: string | null }) => {
    const p = new URLSearchParams();
    const t = cambios.tipo === undefined ? tipo : cambios.tipo;
    const po = cambios.pos === undefined ? posicion : cambios.pos;
    if (t) p.set("tipo", t);
    if (po) p.set("pos", po);
    const s = p.toString();
    return `/equipo/mercado${s ? `?${s}` : ""}`;
  };
  const volver = enlace({});
  const filtro = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-semibold ${activo ? "bg-cesped text-white dark:text-black" : "border border-borde hover:bg-fondo"}`;

  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS_EQUIPO} />
      <Aviso ok={q.ok} error={q.error} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato
          etiqueta="Ventana de traspasos"
          valor={estado.ventana ? "Abierta" : "Cerrada"}
          nota={estado.ventana ? "Puedes fichar transferibles" : "Abre en pretemporada y en las jornadas 17 a 22"}
          tono={estado.ventana ? "positivo" : "negativo"}
        />
        <Dato etiqueta="Caja" valor={formatoEuros(estado.caja)} />
        <Dato etiqueta="Plantilla" valor={`${estado.plantilla} / ${MERCADO_LOCAL.maximoPlantilla}`} nota="Fichas del primer equipo" />
        <Dato
          etiqueta="Dirección deportiva"
          valor={`Hasta ${formatoMedia(estado.topeMedia)}`}
          nota={`Tu ojeador ve las medias con ±${formatoMedia(estado.margen / 10)} de margen`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="min-w-0 rounded-2xl border border-borde bg-superficie xl:col-span-9">
          <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
            <Link href={enlace({ tipo: null })} className={filtro(!tipo)}>
              Todos
            </Link>
            <Link href={enlace({ tipo: "libres" })} className={filtro(tipo === "libres")}>
              Agentes libres
            </Link>
            <Link href={enlace({ tipo: "transferibles" })} className={filtro(tipo === "transferibles")}>
              Transferibles
            </Link>
            <span className="mx-1 h-6 w-px bg-borde" aria-hidden />
            <Link href={enlace({ pos: null })} className={filtro(!posicion)}>
              Todas
            </Link>
            {POSICIONES.map((p) => (
              <Link key={p} href={enlace({ pos: p })} className={filtro(posicion === p)}>
                {p}
              </Link>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-y border-borde text-left text-xs text-suave">
                  <th className="py-2 pr-2 pl-5 font-medium">Jugador</th>
                  <th className="px-2 py-2 font-medium">Pos.</th>
                  <th className="px-2 py-2 text-right font-medium">Edad</th>
                  <th className="px-2 py-2 text-right font-medium" title="Lo que ve tu ojeador">Media estimada</th>
                  <th className="px-2 py-2 font-medium">Procedencia</th>
                  <th className="px-2 py-2 text-right font-medium">Precio</th>
                  <th className="px-2 py-2 text-right font-medium">Salario que pide</th>
                  <th className="py-2 pr-5 pl-2 text-right font-medium">Fichar</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((o) => {
                  const libre = !o.clubId;
                  const bloqueado = !libre && !estado.ventana;
                  const caro = o.precio * (1 + MERCADO.comisionFederacion) > estado.caja;
                  return (
                    <tr key={o.id} className="border-b border-borde/60 last:border-0 hover:bg-fondo/60">
                      <td className="py-2 pr-2 pl-5 font-medium whitespace-nowrap">
                        <Link href={`/jugador/${o.id}`} className="hover:text-cesped hover:underline">
                          {o.nombre} {o.apellido}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${COLOR_POSICION[o.posicion]}`}>{o.posicion}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{o.edad}</td>
                      <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                        {formatoMedia(o.mediaRango[0])} – {formatoMedia(o.mediaRango[1])}
                      </td>
                      <td className="px-2 py-2 text-suave">{libre ? "Agente libre" : o.club}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{libre ? "—" : formatoEuros(o.precio)}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{formatoEuros(o.salarioPedido)}</td>
                      <td className="py-2 pr-5 pl-2 text-right">
                        <form action={fichar} className="inline-flex items-center gap-1.5">
                          <input type="hidden" name="jugador" value={o.id} />
                          <input type="hidden" name="volver" value={volver} />
                          <select name="temporadas" defaultValue="2" aria-label="Duración del contrato" className="rounded-lg border border-borde bg-fondo px-1.5 py-1 text-xs">
                            <option value="1">1 temp.</option>
                            <option value="2">2 temp.</option>
                            <option value="3">3 temp.</option>
                          </select>
                          <button
                            type="submit"
                            disabled={bloqueado || (!libre && caro)}
                            title={bloqueado ? "Ventana de traspasos cerrada" : caro ? "No hay dinero suficiente" : undefined}
                            className="rounded-full bg-cesped px-3 py-1 text-xs font-semibold text-white disabled:opacity-40 dark:text-black"
                          >
                            Fichar
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {ofertas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-center text-suave">
                      No hay jugadores con esos filtros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="grid content-start gap-5 xl:col-span-3">
          <section className="rounded-2xl border border-borde bg-superficie p-5">
            <h2 className="font-semibold">Tus jugadores en venta</h2>
            {enVenta.length === 0 ? (
              <p className="mt-2 text-sm text-suave">Ninguno. Para vender, entra en la ficha del jugador.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {enVenta.map((j) => (
                  <li key={j.id} className="flex justify-between gap-2">
                    <Link href={`/jugador/${j.id}`} className="truncate hover:underline">
                      {j.nombre} {j.apellido}
                    </Link>
                    <span className="tabular-nums">{formatoEuros(j.precioVenta!)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-borde bg-superficie p-5 text-sm">
            <h2 className="font-semibold">Cómo funciona</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-suave">
              <li>Agentes libres: siempre disponibles, sin traspaso. Cobran una prima de un cuarto de su salario.</li>
              <li>Transferibles: solo con la ventana abierta. La federación cobra un {Math.round(MERCADO.comisionFederacion * 1000) / 10} % al comprador.</li>
              <li>Tus jugadores en venta reciben ofertas de los bots con la ventana abierta; cuanto más ajustado el precio, antes se venden.</li>
              <li>Los jugadores también deciden: el salario que pide depende de su media y su carácter.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
