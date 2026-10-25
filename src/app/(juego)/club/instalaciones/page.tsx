import { NOMBRE_INSTALACION } from "@/componentes/formato";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { fichaClub, managerLocal } from "@/servidor/consultas";
import { PESTANAS_CLUB } from "../pestanas";

export const dynamic = "force-dynamic";

const DESCRIPCION: Record<string, string> = {
  estadio: "Gradas, restauración y césped. Su capacidad marca la taquilla.",
  sede: "Dirección deportiva (tope de fichajes), ojeadores, sala de vídeo y prensa.",
  ciudad_deportiva: "Campos de entrenamiento, gimnasio y zona de porteros.",
  centro_medico: "Médico, fisioterapia y área de bienestar.",
  escuela_cantera: "Entrenador de cantera, filial y residencia de juveniles.",
};

export default async function Instalaciones() {
  const manager = (await managerLocal())!;
  const club = (await fichaClub(manager.clubId))!;
  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <p className="mb-5 max-w-3xl text-sm text-suave">
        Cada mejora exige tres llaves: nivel de mánager, nivel del edificio y pagarla. Ninguna área puede superar el nivel de su
        edificio. Las obras llegan en una próxima versión.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {club.edificios.map((e) => (
          <li key={e.tipo} className={`rounded-2xl border bg-superficie p-5 ${e.nivel === 0 ? "border-dashed border-borde" : "border-borde"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={`font-semibold ${e.nivel === 0 ? "text-suave" : ""}`}>{NOMBRE_INSTALACION[e.tipo] ?? e.tipo}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.nivel === 0 ? "bg-fondo text-suave" : "bg-cesped-suave text-cesped"}`}>
                {e.nivel === 0 ? "Sin construir" : `Nivel ${e.nivel}`}
              </span>
            </div>
            <p className="mt-2 text-sm text-suave">{DESCRIPCION[e.tipo]}</p>
            {e.areas.length > 0 ? (
              <ul className="mt-3 space-y-1 border-t border-borde pt-3 text-sm">
                {e.areas.map((a) => (
                  <li key={a.tipo} className="flex justify-between">
                    <span>{NOMBRE_INSTALACION[a.tipo] ?? a.tipo}</span>
                    <span className="text-suave">Nivel {a.nivel}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
