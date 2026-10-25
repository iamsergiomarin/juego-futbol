import { redirect } from "next/navigation";
import { Navegacion } from "@/componentes/juego/Navegacion";
import { modoLocal } from "@/servidor/bd";
import { cabeceraClub, estadoTemporada, managerLocal } from "@/servidor/consultas";
import { asegurarCalendario } from "@/servidor/liga";
import { asegurarMercado } from "@/servidor/mercado";

export const dynamic = "force-dynamic";

/** Marco común del juego: barra de navegación fija y contenido a todo el ancho. */
export default async function LayoutJuego({ children }: { children: React.ReactNode }) {
  if (!modoLocal()) redirect("/prototipo");
  const manager = await managerLocal();
  if (!manager) redirect("/nuevo");
  // Partidas creadas antes de que existiera la liga reciben aquí su calendario.
  await asegurarCalendario();
  await asegurarMercado();
  const [club, temporada] = await Promise.all([cabeceraClub(manager.clubId), estadoTemporada()]);
  if (!club) redirect("/nuevo");

  return (
    <div className="min-h-screen">
      <Navegacion club={club} temporada={temporada} />
      <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
