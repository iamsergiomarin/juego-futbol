import { Pestanas } from "@/componentes/juego/Pestanas";
import { bdLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { potencialEstimado } from "@/servidor/jugador";
import { despuesDeJornada } from "@/dominio/entrenamiento";
import { estadoSemana, jugadoresEstado, planEntrenamiento } from "@/servidor/plantilla";
import { PESTANAS_EQUIPO } from "../pestanas";
import { FormularioEntrenamiento } from "./FormularioEntrenamiento";

export const dynamic = "force-dynamic";

export default async function Entrenamiento() {
  const manager = (await managerLocal())!;
  const bd = await bdLocal();
  const semana = await estadoSemana(bd);
  const [jugadores, plan, calidad] = await Promise.all([
    jugadoresEstado(bd, manager.clubId),
    planEntrenamiento(bd, manager.clubId),
    bd.query<{ c: number }>("select coalesce(max(calidad), 25)::int as c from personal where club_id = $1 and puesto = 'segundo_entrenador'", [manager.clubId]),
  ]);
  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS_EQUIPO} />
      <FormularioEntrenamiento
        planInicial={plan}
        hoy={semana.hoy}
        hechos={despuesDeJornada(semana.jugadas).dias.slice(0, semana.hechos)}
        diasPendientes={semana.diasPendientes}
        jugadores={jugadores.map((j) => ({
          id: j.id,
          nombre: `${j.nombre} ${j.apellido}`,
          posicion: j.posicion,
          edad: j.edad,
          media: j.media,
          potencialTexto: potencialEstimado(j.potencial, calidad.rows[0].c, j.id),
          cansancio: j.cansancio,
          lesion: j.jornadasLesion,
          foco: j.foco,
          semana: j.cambiosSemana,
        }))}
      />
    </>
  );
}
