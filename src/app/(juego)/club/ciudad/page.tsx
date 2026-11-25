import { Aviso } from "@/componentes/juego/Aviso";
import { Ciudad } from "@/componentes/juego/Ciudad";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { fichaClub, managerLocal } from "@/servidor/consultas";
import { edificiosConObras } from "@/servidor/instalaciones";
import { PESTANAS_CLUB } from "../pestanas";

export const dynamic = "force-dynamic";

export default async function PaginaCiudad({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const manager = (await managerLocal())!;
  const [club, edificios] = await Promise.all([fichaClub(manager.clubId), edificiosConObras(manager.clubId)]);
  if (!club) return null;
  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <Aviso ok={q.ok} error={q.error} />
      <Ciudad
        edificios={edificios}
        principal={club.colorPrincipal}
        secundario={club.colorSecundario}
        aforo={club.aforo}
        dinero={club.dinero}
        nombreClub={club.nombre}
      />
    </>
  );
}
