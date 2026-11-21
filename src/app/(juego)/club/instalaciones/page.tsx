import { NOMBRE_INSTALACION } from "@/componentes/formato";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { fichaClub, managerLocal } from "@/servidor/consultas";
import { Aviso } from "@/componentes/juego/Aviso";
import { formatoEuros, formatoFechaHora } from "@/componentes/formato";
import { OBRAS_EDIFICIOS } from "@/dominio/reglas";
import { edificiosConObras } from "@/servidor/instalaciones";
import { mejorarEdificio } from "../../acciones";
import { PESTANAS_CLUB } from "../pestanas";

export const dynamic = "force-dynamic";

const DESCRIPCION: Record<string, string> = {
  estadio: "Gradas, restauración y césped. Su capacidad marca la taquilla.",
  sede: "Dirección deportiva (tope de fichajes), ojeadores, sala de vídeo y prensa.",
  ciudad_deportiva: "Campos de entrenamiento, gimnasio y zona de porteros.",
  centro_medico: "Médico, fisioterapia y área de bienestar.",
  escuela_cantera: "Entrenador de cantera, filial y residencia de juveniles.",
};

const EFECTO: Record<string, string> = {
  estadio: `Cada nivel añade ${OBRAS_EDIFICIOS.aforoPorNivelEstadio.toLocaleString("es-ES")} plazas a la tribuna.`,
  sede: "Cada nivel sube un punto la dirección deportiva y la oficina de ojeadores.",
  ciudad_deportiva: "Mejores campos: los entrenamientos rinden más.",
  centro_medico: "Cada nivel da un 10 % de opciones de recortar una jornada de baja.",
  escuela_cantera: "Hornadas de juveniles: más nivel, más chavales y más opciones de joya.",
};

export default async function Instalaciones({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const manager = (await managerLocal())!;
  const [club, obras] = await Promise.all([fichaClub(manager.clubId), edificiosConObras(manager.clubId)]);
  if (!club) return null;
  const caja = club.dinero;
  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <p className="mb-5 max-w-3xl text-sm text-suave">
        Cada mejora se paga por adelantado y dura como máximo 48 horas: se inaugura en cuanto se juega la próxima jornada. Ninguna área puede
        superar el nivel de su edificio.
      </p>
      <Aviso ok={q.ok} error={q.error} />
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
            <p className="mt-1 text-xs text-suave">{EFECTO[e.tipo]}</p>
            {(() => {
              const o = obras.find((x) => x.tipo === e.tipo);
              if (!o) return null;
              if (o.obra) return <p className="mt-3 rounded-lg bg-cesped-suave px-3 py-2 text-sm text-cesped">Obra hacia el nivel {o.obra.destino}: lista el {formatoFechaHora(o.obra.fin)}.</p>;
              if (!o.destino) return <p className="mt-3 text-sm text-suave">Nivel máximo.</p>;
              return (
                <form action={mejorarEdificio} className="mt-3 flex items-center justify-between gap-3 border-t border-borde pt-3">
                  <input type="hidden" name="edificio" value={e.tipo} />
                  <span className="text-sm text-suave">
                    {o.nivel === 0 ? "Construir" : `Nivel ${o.destino}`}: {formatoEuros(o.coste!)} · {o.horas} h
                  </span>
                  <button disabled={caja < o.coste!} className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40 dark:text-black">
                    {o.nivel === 0 ? "Construir" : "Mejorar"}
                  </button>
                </form>
              );
            })()}
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
