import type { PublicacionVista } from "@/servidor/grada";

const COLOR_AUTOR: Record<PublicacionVista["autorTipo"], string> = {
  club: "bg-cesped text-white dark:text-black",
  prensa: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  pena: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  aficion: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  rival: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
};

const ETIQUETA_AUTOR: Record<PublicacionVista["autorTipo"], string | null> = {
  club: "Oficial",
  prensa: "Prensa",
  pena: "Peña",
  aficion: null,
  rival: "Rival",
};

function iniciales(nombre: string): string {
  const partes = nombre.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** 1.250 → "1,2 mil" (formato de las redes). */
export function contar(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toFixed(1).replace(".", ",")} mil`;
  return `${Math.round(n / 1000)} mil`;
}

function fechaCorta(ms: number): string {
  const f = new Date(ms);
  const dia = f.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" }).replace(".", "");
  const hora = f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  return `${dia} · ${hora}`;
}

function Icono({ tipo }: { tipo: "comentar" | "compartir" | "gusta" }) {
  const rutas = {
    comentar: "M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.4A8 8 0 1 1 21 12Z",
    compartir: "M7 7h10v10M7 17 17 7",
    gusta: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  };
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={rutas[tipo]} />
    </svg>
  );
}

/** Una publicación de La Grada, con sus respuestas debajo. */
export function Publicacion({ p, profundidad = 0, sinRespuestas = false }: { p: PublicacionVista; profundidad?: number; sinRespuestas?: boolean }) {
  const etiqueta = ETIQUETA_AUTOR[p.autorTipo];
  return (
    <article className={profundidad === 0 ? "px-4 py-4 sm:px-5" : "mt-3"}>
      <div className="flex gap-3">
        <span
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${COLOR_AUTOR[p.autorTipo]} ${profundidad === 0 ? "h-10 w-10" : "h-8 w-8"}`}
        >
          {iniciales(p.autorNombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-snug">
            <span className="font-semibold">{p.autorNombre}</span>
            {etiqueta ? <span className="rounded bg-fondo px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-suave uppercase">{etiqueta}</span> : null}
            <span className="text-suave">{p.autorUsuario}</span>
            <span className="text-suave">· {fechaCorta(p.fecha)}</span>
            {p.jornada ? <span className="text-suave">· J{p.jornada}</span> : null}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed break-words whitespace-pre-line">{p.texto}</p>
          <p className="mt-2 flex gap-5 text-xs text-suave">
            <span className="inline-flex items-center gap-1.5" title="Comentarios">
              <Icono tipo="comentar" />
              {contar(p.comentarios)}
            </span>
            <span className="inline-flex items-center gap-1.5" title="Compartidos">
              <Icono tipo="compartir" />
              {contar(p.compartidos)}
            </span>
            <span className={`inline-flex items-center gap-1.5 ${p.tono === "positivo" ? "text-cesped" : ""}`} title="Me gusta">
              <Icono tipo="gusta" />
              {contar(p.meGusta)}
            </span>
          </p>
          {!sinRespuestas && p.respuestas.length > 0 ? (
            <div className="mt-1 border-l-2 border-borde pl-3">
              {p.respuestas.map((r) => (
                <Publicacion key={r.id} p={r} profundidad={profundidad + 1} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Barra del ambiente: de enfadada a eufórica. */
export function BarraAnimo({ animo, etiqueta, tono }: { animo: number; etiqueta: string; tono: "positivo" | "neutro" | "negativo" }) {
  const color = tono === "positivo" ? "bg-cesped" : tono === "negativo" ? "bg-rival" : "bg-amber-500";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold">{etiqueta}</p>
        <p className="text-sm tabular-nums text-suave">{animo} / 100</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fondo" role="meter" aria-valuenow={animo} aria-valuemin={0} aria-valuemax={100} aria-label="Ánimo de la grada">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${animo}%` }} />
      </div>
    </div>
  );
}
