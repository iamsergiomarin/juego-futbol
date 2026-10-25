import { Pestanas } from "@/componentes/juego/Pestanas";
import { bdLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { jugadoresEstado, planteamientoClub } from "@/servidor/plantilla";
import { PESTANAS_EQUIPO } from "../pestanas";
import { FormularioAlineacion } from "./FormularioAlineacion";

export const dynamic = "force-dynamic";

export default async function Alineacion() {
  const manager = (await managerLocal())!;
  const bd = await bdLocal();
  const jugadores = await jugadoresEstado(bd, manager.clubId);
  const planteamiento = await planteamientoClub(bd, manager.clubId, jugadores);
  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS_EQUIPO} />
      <FormularioAlineacion
        inicial={planteamiento}
        jugadores={jugadores.map((j) => ({
          id: j.id,
          nombre: `${j.nombre} ${j.apellido}`,
          posicion: j.posicion,
          media: j.media,
          cansancio: j.cansancio,
          forma: j.forma,
          lesion: j.jornadasLesion,
        }))}
      />
    </>
  );
}
