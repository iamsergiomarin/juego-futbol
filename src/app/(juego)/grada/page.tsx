import Link from "next/link";
import { formatoEntero } from "@/componentes/formato";
import { Caja } from "@/componentes/juego/Caja";
import { BarraAnimo, contar, Publicacion } from "@/componentes/juego/Publicacion";
import { bdLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { Aviso } from "@/componentes/juego/Aviso";
import { LIMITE_COMUNICADO } from "@/dominio/grada";
import { publicarComoClub } from "../acciones";
import { estadoGrada, lineaDeTiempo, type FiltroGrada } from "@/servidor/grada";

export const dynamic = "force-dynamic";

const FILTROS: { id: FiltroGrada; etiqueta: string }[] = [
  { id: "todo", etiqueta: "Todo" },
  { id: "aficion", etiqueta: "Afición" },
  { id: "prensa", etiqueta: "Prensa" },
  { id: "club", etiqueta: "El club" },
];

const TIPO_VOZ: Record<string, string> = { club: "Cuenta oficial", pena: "Peña", aficion: "Aficionado", prensa: "Prensa local" };

export default async function Grada({ searchParams }: { searchParams: Promise<{ ver?: string; ok?: string; error?: string }> }) {
  const q = await searchParams;
  const filtro = FILTROS.some((f) => f.id === q.ver) ? (q.ver as FiltroGrada) : "todo";
  const manager = (await managerLocal())!;
  const bd = await bdLocal();
  const [publicaciones, estado] = await Promise.all([lineaDeTiempo(bd, manager.clubId, filtro), estadoGrada(bd, manager.clubId)]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-borde">
        <h1 className="pb-3 text-2xl font-bold tracking-tight">La Grada</h1>
        <nav aria-label="Filtrar publicaciones" className="-mb-px flex gap-1 overflow-x-auto">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={f.id === "todo" ? "/grada" : `/grada?ver=${f.id}`}
              aria-current={filtro === f.id ? "page" : undefined}
              className={
                "shrink-0 border-b-2 px-3 pb-3 text-sm font-semibold transition-colors " +
                (filtro === f.id ? "border-cesped text-texto" : "border-transparent text-suave hover:text-texto")
              }
            >
              {f.etiqueta}
            </Link>
          ))}
        </nav>
      </div>

      <Aviso ok={q.ok} error={q.error} />
      <form action={publicarComoClub} className="mb-5 rounded-2xl border border-borde bg-superficie p-4">
        <label htmlFor="texto" className="text-sm font-semibold">
          Habla como club
        </label>
        <textarea id="texto" name="texto" rows={2} maxLength={LIMITE_COMUNICADO} required placeholder="Un comunicado para la afición…" className="mt-2 w-full resize-none rounded-xl border border-borde bg-fondo p-3 text-sm" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-suave">Máximo dos por jornada. La afición contesta, pero solo los resultados mueven su ánimo.</p>
          <button className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white dark:text-black">Publicar</button>
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-12">
        <section aria-label="Publicaciones" className="min-w-0 overflow-hidden rounded-2xl border border-borde bg-superficie lg:col-span-8 xl:col-span-7">
          {publicaciones.length === 0 ? (
            <p className="p-6 text-sm text-suave">Aquí todavía no ha dicho nada nadie. Juega la primera jornada y la grada se pondrá a hablar.</p>
          ) : (
            <div className="divide-y divide-borde">
              {publicaciones.map((p) => (
                <Publicacion key={p.id} p={p} />
              ))}
            </div>
          )}
        </section>

        <aside className="grid content-start gap-5 lg:col-span-4 xl:col-span-5 xl:grid-cols-2">
          <Caja titulo="Ambiente en la grada" className="xl:col-span-2">
            <BarraAnimo animo={estado.animo} etiqueta={estado.etiqueta} tono={estado.tono} />
            <p className="mt-3 text-sm text-suave">
              {formatoEntero(estado.seguidores)} seguidores siguen al club. Una grada contenta llena más el campo; una enfadada lo deja vacío.
              Las victorias, los fichajes que ilusionan y los ascensos suben el ánimo; las derrotas y vender a las estrellas lo bajan.
            </p>
          </Caja>

          <Caja titulo="Lo más visto">
            {estado.masComentadas.length === 0 ? (
              <p className="text-sm text-suave">Todavía nada.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {estado.masComentadas.map((p) => (
                  <li key={p.id}>
                    <p className="font-semibold">{p.autorNombre}</p>
                    <p className="line-clamp-3 text-suave">{p.texto}</p>
                    <p className="mt-0.5 text-xs text-suave tabular-nums">♥ {contar(p.meGusta)}</p>
                  </li>
                ))}
              </ul>
            )}
            {estado.etiquetas.length > 0 ? (
              <p className="mt-4 flex flex-wrap gap-1.5 border-t border-borde pt-3">
                {estado.etiquetas.map((e) => (
                  <span key={e} className="rounded-full bg-cesped-suave px-2.5 py-1 text-xs font-semibold text-cesped">
                    {e}
                  </span>
                ))}
              </p>
            ) : null}
          </Caja>

          <Caja titulo="Las cuentas de tu grada">
            <ul className="space-y-2.5 text-sm">
              {estado.voces.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{v.nombre}</span>
                    <span className="block truncate text-xs text-suave">{v.usuario}</span>
                  </span>
                  <span className="shrink-0 text-xs text-suave">{TIPO_VOZ[v.tipo]}</span>
                </li>
              ))}
            </ul>
          </Caja>
        </aside>
      </div>
    </>
  );
}
