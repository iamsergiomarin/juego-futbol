import { Caja } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { historialClub, managerLocal } from "@/servidor/consultas";
import { PESTANAS_COMPETICION } from "../pestanas";

export const dynamic = "force-dynamic";

const TEXTO: Record<string, [string, string]> = {
  campeon: ["Campeón · asciende", "bg-cesped text-white dark:text-black"],
  ascenso: ["Asciende por playoff", "bg-cesped text-white dark:text-black"],
  playoff: ["Playoff", "bg-cesped-suave text-cesped"],
  permanencia: ["Permanencia", "bg-fondo text-texto"],
  descenso: ["Descenso", "bg-rival text-white dark:text-black"],
};

export default async function Historial() {
  const manager = (await managerLocal())!;
  const filas = await historialClub(manager.clubId);
  return (
    <>
      <Pestanas titulo="Competición" pestanas={PESTANAS_COMPETICION} />
      <Caja titulo="Temporadas del club" sinRelleno>
        {filas.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-suave">La primera temporada todavía está en juego. Aquí quedará la historia del club.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-suave">
                <th className="py-2 pr-2 pl-5 font-medium">Temporada</th>
                <th className="px-2 py-2 font-medium">Categoría</th>
                <th className="px-2 py-2 text-right font-medium">Puesto</th>
                <th className="px-2 py-2 text-right font-medium">Puntos</th>
                <th className="py-2 pr-5 pl-2 font-medium">Desenlace</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.temporada} className="border-b border-borde/60 last:border-0">
                  <td className="py-2.5 pr-2 pl-5 font-semibold">{f.temporada}</td>
                  <td className="px-2 py-2.5">
                    {f.division} · Grupo {f.grupo}
                  </td>
                  <td className="px-2 py-2.5 text-right font-bold tabular-nums">{f.posicion}.º</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f.puntos}</td>
                  <td className="py-2.5 pr-5 pl-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEXTO[f.desenlace]?.[1] ?? ""}`}>{TEXTO[f.desenlace]?.[0] ?? f.desenlace}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Caja>
    </>
  );
}
