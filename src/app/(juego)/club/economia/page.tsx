import { formatoEuros, formatoSigno } from "@/componentes/formato";
import { Caja, Dato } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { division } from "@/dominio/reglas";
import { bdLocal } from "@/servidor/bd";
import { managerLocal, movimientosPorJornada, resumenEconomia } from "@/servidor/consultas";
import { PESTANAS_CLUB } from "../pestanas";

export const dynamic = "force-dynamic";

export default async function Economia() {
  const manager = (await managerLocal())!;
  const bd = await bdLocal();
  const [eco, jornadas, nivel] = await Promise.all([
    resumenEconomia(manager.clubId),
    movimientosPorJornada(manager.clubId),
    bd.query<{ d: number }>("select coalesce(g.division, 5)::int as d from clubes c left join grupos g on g.id = c.grupo_id where c.id = $1", [manager.clubId]),
  ]);
  const div = division(nivel.rows[0].d as 0 | 1 | 2 | 3 | 4 | 5);
  // Ingresos de referencia para el control salarial: el presupuesto de la división.
  const porcentajeSalarial = eco.masaSalarial / div.presupuesto;
  const limite = div.limiteSalarial;
  const ingresos = eco.porConcepto.filter((c) => c.importe > 0);
  const gastos = eco.porConcepto.filter((c) => c.importe < 0);
  const maximo = Math.max(1, ...eco.porConcepto.map((c) => Math.abs(c.importe)));

  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato etiqueta="Caja" valor={formatoEuros(eco.caja)} tono={eco.caja < 0 ? "negativo" : undefined} />
        <Dato etiqueta="Balance de la temporada" valor={formatoSigno(eco.ingresos + eco.gastos)} tono={eco.ingresos + eco.gastos >= 0 ? "positivo" : "negativo"} />
        <Dato etiqueta="Masa salarial" valor={formatoEuros(eco.masaSalarial)} nota="por temporada (plantilla y cuerpo técnico)" />
        <Dato
          etiqueta={`Control salarial (${div.controlSalarial})`}
          valor={`${Math.round(porcentajeSalarial * 100)} % de ${Math.round(limite * 100)} %`}
          nota={`Masa salarial sobre el presupuesto de ${div.nombre}`}
          tono={porcentajeSalarial > limite ? "negativo" : "positivo"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Caja titulo="Ingresos y gastos de la temporada" className="xl:col-span-5">
          {eco.porConcepto.length === 0 ? (
            <p className="text-sm text-suave">Aún no hay movimientos.</p>
          ) : (
            <div className="space-y-5">
              {[
                ["Ingresos", ingresos, "bg-cesped"],
                ["Gastos", gastos, "bg-rival"],
              ].map(([titulo, lista, color]) => (
                <div key={titulo as string}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-suave uppercase">{titulo as string}</h3>
                  <ul className="space-y-2.5">
                    {(lista as typeof ingresos).map((c) => (
                      <li key={c.concepto} className="text-sm">
                        <div className="flex justify-between gap-3">
                          <span>{c.concepto}</span>
                          <span className="tabular-nums">{formatoSigno(c.importe)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fondo">
                          <div className={`h-full ${color as string}`} style={{ width: `${(100 * Math.abs(c.importe)) / maximo}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-5 border-t border-borde pt-3 text-xs text-suave">
            Televisión y patrocinio son provisionales hasta que lleguen los contratos de patrocinio.
          </p>
        </Caja>

        <Caja titulo="Movimientos por jornada" className="xl:col-span-7" sinRelleno>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-suave">
                  <th className="py-2 pr-2 pl-5 font-medium">Jornada</th>
                  <th className="px-2 py-2 font-medium">Conceptos</th>
                  <th className="px-2 py-2 text-right font-medium">Ingresos</th>
                  <th className="px-2 py-2 text-right font-medium">Gastos</th>
                  <th className="py-2 pr-5 pl-2 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {jornadas.map((j) => {
                  const neto = j.ingresos + j.gastos;
                  return (
                    <tr key={j.jornada ?? "fuera"} className="border-b border-borde/60 align-top last:border-0">
                      <td className="py-2 pr-2 pl-5 font-medium whitespace-nowrap">{j.jornada ? `J${j.jornada}` : "Mercado y otros"}</td>
                      <td className="px-2 py-2 text-xs text-suave">{j.detalle.map((d) => d.concepto).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap text-cesped tabular-nums">{j.ingresos ? formatoEuros(j.ingresos) : "—"}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap text-rival tabular-nums">{j.gastos ? formatoEuros(-j.gastos) : "—"}</td>
                      <td className={`py-2 pr-5 pl-2 text-right font-semibold whitespace-nowrap tabular-nums ${neto >= 0 ? "" : "text-rival"}`}>{formatoSigno(neto)}</td>
                    </tr>
                  );
                })}
                {jornadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-suave">
                      Sin movimientos todavía.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Caja>
      </div>
    </>
  );
}
