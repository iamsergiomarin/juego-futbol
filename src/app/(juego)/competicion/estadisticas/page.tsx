import { Caja } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { equiposGrupo, goleadoresGrupo, managerLocal } from "@/servidor/consultas";
import { PESTANAS_COMPETICION } from "../pestanas";

export const dynamic = "force-dynamic";

const coma = (n: number) => n.toFixed(2).replace(".", ",");

export default async function Estadisticas() {
  const manager = (await managerLocal())!;
  const [goleadores, equipos] = await Promise.all([goleadoresGrupo(manager.clubId), equiposGrupo(manager.clubId)]);
  const conPartidos = equipos.filter((e) => e.jugados > 0);
  const mejorAtaque = [...conPartidos].sort((a, b) => b.golesFavor / b.jugados - a.golesFavor / a.jugados).slice(0, 5);
  const mejorDefensa = [...conPartidos].sort((a, b) => a.golesContra / a.jugados - b.golesContra / b.jugados).slice(0, 5);
  const imbatida = [...conPartidos].sort((a, b) => b.porteriaCero - a.porteriaCero).slice(0, 5);

  const lista = (titulo: string, filas: typeof mejorAtaque, valor: (e: (typeof mejorAtaque)[number]) => string) => (
    <Caja titulo={titulo}>
      {filas.length === 0 ? (
        <p className="text-sm text-suave">Aún no hay partidos.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {filas.map((e, i) => (
            <li key={e.club} className={`flex justify-between gap-3 ${e.propio ? "font-semibold text-cesped" : ""}`}>
              <span>
                <span className="mr-2 text-suave tabular-nums">{i + 1}</span>
                {e.club}
              </span>
              <span className="tabular-nums">{valor(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </Caja>
  );

  return (
    <>
      <Pestanas titulo="Competición" pestanas={PESTANAS_COMPETICION} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Caja titulo="Máximos goleadores del grupo" sinRelleno className="xl:col-span-7">
          {goleadores.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-suave">Todavía no ha caído ningún gol. En cuanto ruede el balón, aquí aparecerá la lucha por el pichichi.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-suave">
                  <th className="py-2 pr-2 pl-5 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Jugador</th>
                  <th className="px-2 py-2 font-medium">Club</th>
                  <th className="px-2 py-2 text-right font-medium">Partidos con gol</th>
                  <th className="py-2 pr-5 pl-2 text-right font-medium">Goles</th>
                </tr>
              </thead>
              <tbody>
                {goleadores.map((g, i) => (
                  <tr key={`${g.jugador}-${g.club}`} className={`border-b border-borde/60 last:border-0 ${g.propio ? "bg-cesped-suave/50" : ""}`}>
                    <td className="py-2.5 pr-2 pl-5 text-suave tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2.5 font-semibold">{g.jugador}</td>
                    <td className="px-2 py-2.5">{g.club}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{g.partidos}</td>
                    <td className="py-2.5 pr-5 pl-2 text-right font-bold tabular-nums">{g.goles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Caja>
        <div className="grid gap-5 xl:col-span-5">
          {lista("Mejor ataque", mejorAtaque, (e) => `${coma(e.golesFavor / e.jugados)} goles por partido`)}
          {lista("Mejor defensa", mejorDefensa, (e) => `${coma(e.golesContra / e.jugados)} en contra por partido`)}
          {lista("Portería a cero", imbatida, (e) => `${e.porteriaCero} partidos`)}
        </div>
      </div>
    </>
  );
}
