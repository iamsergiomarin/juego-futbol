import { Escudo } from "@/componentes/Escudo";
import { formatoEntero, formatoEuros } from "@/componentes/formato";
import { Caja, Dato } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { fichaClub, managerLocal, sectoresEstadio } from "@/servidor/consultas";
import { PESTANAS_CLUB } from "./pestanas";

export const dynamic = "force-dynamic";

const NOMBRE_SECTOR: Record<string, string> = {
  tribuna: "Tribuna principal",
  lateral: "Grada lateral",
  fondo_norte: "Fondo norte",
  fondo_sur: "Fondo sur",
  esquinas: "Esquinas",
  cesped: "Césped",
};

const NIVEL_CESPED = ["Sin cuidar", "Natural básico", "Natural cuidado", "Híbrido"];

export default async function ClubResumen() {
  const manager = (await managerLocal())!;
  const [club, sectores] = await Promise.all([fichaClub(manager.clubId), sectoresEstadio(manager.clubId)]);
  if (!club) return null;
  const gradas = sectores.filter((s) => s.sector !== "cesped");
  const cesped = sectores.find((s) => s.sector === "cesped");

  return (
    <>
      <Pestanas titulo="Club" pestanas={PESTANAS_CLUB} />
      <div className="grid gap-5 lg:grid-cols-12">
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-borde bg-superficie p-6 text-center lg:col-span-4">
          <Escudo principal={club.colorPrincipal} secundario={club.colorSecundario} texto={club.corto} tamano={120} />
          <div>
            <h2 className="text-xl font-bold">{club.nombre}</h2>
            <p className="text-sm text-suave">{club.ciudad}</p>
          </div>
          <dl className="mt-2 grid w-full grid-cols-2 gap-3 border-t border-borde pt-4 text-left text-sm">
            <div>
              <dt className="text-xs text-suave">Mánager</dt>
              <dd className="font-semibold">{club.manager}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Categoría</dt>
              <dd className="font-semibold">
                {club.division} · Grupo {club.grupo}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Fundado</dt>
              <dd className="font-semibold">Temporada {club.temporada.numero}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Popularidad</dt>
              <dd className="font-semibold">{club.popularidad} / 100</dd>
            </div>
          </dl>
        </section>

        <div className="grid content-start gap-5 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Dato etiqueta="Caja" valor={formatoEuros(club.dinero)} />
            <Dato etiqueta="Socios" valor={formatoEntero(club.masaSocial)} />
            <Dato etiqueta="Aforo" valor={`${formatoEntero(club.aforo)} plazas`} />
            <Dato etiqueta="Plantilla" valor={`${club.plantilla.length} jugadores`} />
          </div>

          <Caja titulo="Estadio" extra={<span className="text-xs text-suave">Ampliaciones: próximamente</span>}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {gradas.map((s) => (
                <li key={s.sector} className={`rounded-xl border border-borde p-3 ${s.nivel === 0 ? "border-dashed" : ""}`}>
                  <p className={`text-sm font-semibold ${s.nivel === 0 ? "text-suave" : ""}`}>{NOMBRE_SECTOR[s.sector] ?? s.sector}</p>
                  <p className="text-xs text-suave">
                    {s.nivel === 0 ? "Sin construir" : `${formatoEntero(s.aforo)} plazas · ${s.puntosVenta} puntos de venta`}
                  </p>
                </li>
              ))}
              {cesped ? (
                <li className="rounded-xl border border-borde p-3">
                  <p className="text-sm font-semibold">Césped</p>
                  <p className="text-xs text-suave">{NIVEL_CESPED[cesped.nivel] ?? `Nivel ${cesped.nivel}`}</p>
                </li>
              ) : null}
            </ul>
          </Caja>
        </div>
      </div>
    </>
  );
}
