/** Energía (100 − cansancio), forma y bajas de un jugador, en pequeño. */
export function Energia({ cansancio }: { cansancio: number }) {
  const energia = Math.round(100 - cansancio * 100);
  const color = energia >= 75 ? "bg-cesped" : energia >= 50 ? "bg-amber-500" : "bg-rival";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Energía ${energia} %`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-fondo">
        <span className={`block h-full ${color}`} style={{ width: `${energia}%` }} />
      </span>
      <span className="w-11 text-xs whitespace-nowrap tabular-nums text-suave">{energia} %</span>
    </span>
  );
}

export function Forma({ forma }: { forma: number }) {
  const [icono, color, texto] =
    forma >= 65 ? ["▲▲", "text-cesped", "Muy buena"] : forma >= 55 ? ["▲", "text-cesped", "Buena"] : forma > 45 ? ["●", "text-suave", "Normal"] : forma > 35 ? ["▼", "text-rival", "Baja"] : ["▼▼", "text-rival", "Muy baja"];
  return (
    <span className={`text-xs font-bold ${color}`} title={`Forma: ${texto}`}>
      {icono}
    </span>
  );
}

export function Baja({ jornadas, tipo }: { jornadas: number; tipo: string | null }) {
  if (jornadas <= 0) return null;
  return (
    <span className="rounded bg-rival-suave px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-rival" title={tipo ?? "Lesión"}>
      ✚ {jornadas} {jornadas === 1 ? "jornada" : "jornadas"}
    </span>
  );
}

/** Flechas de evolución de la semana: +2 / −1 en total. */
export function CambiosSemana({ cambios }: { cambios: Record<string, number> }) {
  const total = Object.values(cambios).reduce((a, v) => a + v, 0);
  if (total === 0) return <span className="text-xs text-suave">—</span>;
  return (
    <span className={`text-xs font-bold tabular-nums ${total > 0 ? "text-cesped" : "text-rival"}`} title={Object.entries(cambios).map(([a, v]) => `${a} ${v > 0 ? "+" : ""}${v}`).join(", ")}>
      {total > 0 ? `▲ +${total}` : `▼ ${total}`}
    </span>
  );
}
