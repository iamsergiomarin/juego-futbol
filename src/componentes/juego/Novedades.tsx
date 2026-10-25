import type { Noticia } from "@/servidor/noticias";

const ICONO: Record<string, [string, string]> = {
  lesion: ["✚", "text-rival"],
  entrenamiento: ["▲", "text-cesped"],
  fichaje: ["＋", "text-cesped"],
  venta: ["€", "text-amber-600"],
  contrato: ["✎", "text-suave"],
  temporada: ["★", "text-amber-500"],
  partido: ["⚽", "text-suave"],
  alineacion: ["⇄", "text-amber-600"],
};

/** Lo que te cuenta tu cuerpo técnico: lesiones, informes, fichajes, contratos… */
export function Novedades({ noticias }: { noticias: Noticia[] }) {
  if (noticias.length === 0) {
    return <p className="text-sm text-suave">Sin novedades todavía. Tu cuerpo técnico te irá contando lo que pase en el club.</p>;
  }
  return (
    <ul className="space-y-3">
      {noticias.map((n) => {
        const [icono, color] = ICONO[n.tipo] ?? ["•", "text-suave"];
        return (
          <li key={n.id} className="flex gap-3 text-sm">
            <span aria-hidden className={`mt-0.5 w-5 shrink-0 text-center font-bold ${color}`}>
              {icono}
            </span>
            <span className="min-w-0">
              <span className="font-semibold">{n.titulo}</span>
              {n.jornada ? <span className="ml-1.5 text-xs text-suave">J{n.jornada}</span> : null}
              <span className="block text-suave">{n.texto}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
