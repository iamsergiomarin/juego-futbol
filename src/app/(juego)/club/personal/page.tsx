import { formatoEuros, NOMBRE_PUESTO } from "@/componentes/formato";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { fichaClub, managerLocal } from "@/servidor/consultas";
import { PESTANAS_CLUB } from "../pestanas";

export const dynamic = "force-dynamic";

const FUNCION: Record<string, string> = {
  segundo_entrenador: "Dirige cuando no estás, aplica tus condicionales y te da la lectura del partido.",
  preparador_fisico: "Recuperación entre partidos y prevención de lesiones musculares.",
  ojeador: "Estrecha el rango de atributos de los jugadores que analiza.",
};

export default async function Personal() {
  const manager = (await managerLocal())!;
  const club = (await fichaClub(manager.clubId))!;
  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {club.personal.map((p) => (
          <li key={p.puesto} className="rounded-2xl border border-borde bg-superficie p-5">
            <p className="text-xs font-semibold tracking-wide text-suave uppercase">{NOMBRE_PUESTO[p.puesto] ?? p.puesto}</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{p.nombre}</h2>
              <span className="text-2xl font-bold tabular-nums">{p.calidad}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fondo">
              <div className="h-full bg-cesped" style={{ width: `${p.calidad}%` }} />
            </div>
            <p className="mt-3 text-sm text-suave">{FUNCION[p.puesto]}</p>
            <p className="mt-3 border-t border-borde pt-3 text-xs text-suave">Categoría básica · {formatoEuros(p.salario)} por temporada</p>
          </li>
        ))}
        <li className="grid place-items-center rounded-2xl border border-dashed border-borde p-5 text-center text-sm text-suave">
          Más puestos (médico, analista, entrenador de porteros…) al construir sus instalaciones.
        </li>
      </ul>
    </>
  );
}
