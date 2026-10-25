import { Escudo } from "@/componentes/Escudo";
import type { FilaClasificacion } from "@/servidor/consultas";

const COLOR_RACHA = { G: "bg-cesped text-white dark:text-black", E: "bg-borde text-texto", P: "bg-rival text-white dark:text-black" };

/** Zonas de la tabla según el diseño: 1º asciende, 2º-5º playoff, 18º-20º descienden. */
function zona(posicion: number, total: number, conDescenso: boolean): string {
  if (posicion === 1) return "border-l-cesped";
  if (posicion <= 5) return "border-l-cesped/40";
  if (conDescenso && posicion > total - 3) return "border-l-rival";
  return "border-l-transparent";
}

export function TablaClasificacion({
  filas,
  propio,
  compacta = false,
  conDescenso,
}: {
  filas: FilaClasificacion[];
  propio: string;
  compacta?: boolean;
  /** En Quinta no hay descensos: es la puerta de entrada. */
  conDescenso: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-borde text-xs text-suave">
            <th className="py-2 pr-1 pl-4 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Equipo</th>
            <th className="px-1.5 py-2 text-right font-medium">PJ</th>
            {compacta ? null : (
              <>
                <th className="px-1.5 py-2 text-right font-medium">G</th>
                <th className="px-1.5 py-2 text-right font-medium">E</th>
                <th className="px-1.5 py-2 text-right font-medium">P</th>
                <th className="px-1.5 py-2 text-right font-medium">GF</th>
                <th className="px-1.5 py-2 text-right font-medium">GC</th>
              </>
            )}
            <th className="px-1.5 py-2 text-right font-medium">DG</th>
            <th className="px-2 py-2 text-right font-semibold">Pts</th>
            {compacta ? null : <th className="py-2 pr-4 pl-2 text-left font-medium">Últimos</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const mio = f.id === propio;
            const dg = f.golesFavor - f.golesContra;
            return (
              <tr key={f.id} className={`border-b border-borde/60 last:border-0 ${mio ? "bg-cesped-suave font-semibold" : ""}`}>
                <td className={`border-l-4 py-1.5 pr-1 pl-3 tabular-nums text-suave ${zona(f.posicion, filas.length, conDescenso)}`}>{f.posicion}</td>
                <td className="px-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Escudo principal={f.colorPrincipal} secundario={f.colorSecundario} texto={f.corto} tamano={20} titulo={f.nombre} />
                    <span className="truncate">{f.nombre}</span>
                  </span>
                </td>
                <td className="px-1.5 py-1.5 text-right tabular-nums">{f.jugados}</td>
                {compacta ? null : (
                  <>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">{f.ganados}</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">{f.empatados}</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">{f.perdidos}</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">{f.golesFavor}</td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">{f.golesContra}</td>
                  </>
                )}
                <td className="px-1.5 py-1.5 text-right tabular-nums text-suave">{dg > 0 ? `+${dg}` : dg}</td>
                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{f.puntos}</td>
                {compacta ? null : (
                  <td className="py-1.5 pr-4 pl-2">
                    <span className="flex gap-0.5">
                      {[...f.racha].reverse().map((r, i) => (
                        <span key={i} className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${COLOR_RACHA[r]}`}>
                          {r}
                        </span>
                      ))}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 pb-1 text-xs text-suave">
        <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-cesped" /> Ascenso</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-cesped/40" /> Playoff</span>
        {conDescenso ? (
          <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-rival" /> Descenso</span>
        ) : (
          <span>Sin descensos en Quinta</span>
        )}
      </p>
    </div>
  );
}
