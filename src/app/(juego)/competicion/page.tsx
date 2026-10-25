import { Caja } from "@/componentes/juego/Caja";
import { TablaClasificacion } from "@/componentes/juego/Clasificacion";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { cabeceraClub, clasificacion, estadoTemporada, managerLocal } from "@/servidor/consultas";
import { PESTANAS_COMPETICION } from "./pestanas";

export const dynamic = "force-dynamic";

export default async function Competicion() {
  const manager = (await managerLocal())!;
  const club = (await cabeceraClub(manager.clubId))!;
  const [tabla, temporada] = await Promise.all([clasificacion(club.grupoId), estadoTemporada()]);
  return (
    <>
      <Pestanas titulo="Competición" pestanas={PESTANAS_COMPETICION} />
      <div className="grid gap-5 xl:grid-cols-12">
        <Caja
          titulo={`Liga · ${club.division}, grupo ${club.grupo}`}
          extra={
            <span className="text-sm text-suave">
              Jornada {temporada?.jugadas ?? 0} de {temporada?.total ?? 38}
            </span>
          }
          className="xl:col-span-9"
          sinRelleno
        >
          <TablaClasificacion filas={tabla} propio={club.id} conDescenso={club.division !== "Quinta"} />
        </Caja>
        <Caja titulo="Cómo se sube y se baja" className="xl:col-span-3">
          <ul className="space-y-3 text-sm">
            <li>
              <span className="font-semibold">1.º</span> <span className="text-suave">asciende directamente.</span>
            </li>
            <li>
              <span className="font-semibold">2.º a 5.º</span>{" "}
              <span className="text-suave">juegan el playoff; el ganador se cruza con el del grupo hermano y el vencedor sube.</span>
            </li>
            <li>
              <span className="font-semibold">Últimos 3</span>{" "}
              <span className="text-suave">descienden (en Quinta no hay descensos: es la puerta de entrada).</span>
            </li>
            <li className="border-t border-borde pt-3 text-xs text-suave">Los bots nunca ascienden: su plaza pasa al siguiente humano.</li>
          </ul>
        </Caja>
      </div>
    </>
  );
}
