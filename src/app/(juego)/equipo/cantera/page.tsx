import { COLOR_POSICION, formatoMedia } from "@/componentes/formato";
import { Aviso } from "@/componentes/juego/Aviso";
import { Dato } from "@/componentes/juego/Caja";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { CANTERA, FILIAL } from "@/dominio/reglas";
import { MERCADO_LOCAL } from "@/dominio/mercado";
import { managerLocal } from "@/servidor/consultas";
import { juvenilesDelClub } from "@/servidor/cantera";
import { decidirJuvenil } from "../../acciones";
import { PESTANAS_EQUIPO } from "../pestanas";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Cantera({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const manager = (await managerLocal())!;
  const { juveniles, nivel, mediaEquipo, plantilla } = await juvenilesDelClub(manager.clubId);

  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS_EQUIPO} />
      <Aviso ok={q.ok} error={q.error} />
      {nivel === 0 ? (
        <div className="rounded-2xl border border-dashed border-borde p-8 text-center">
          <h2 className="font-semibold">Sin escuela de cantera</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-suave">
            La cantera es el futuro del club: dos hornadas de juveniles por temporada, presentadas en el Día de la Cantera. Construye la escuela en{" "}
            <Link href="/club/instalaciones" className="font-semibold text-cesped hover:underline">
              Instalaciones
            </Link>{" "}
            y los primeros chavales llegarán en cuanto se inaugure.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Dato etiqueta="Escuela" valor={`Nivel ${nivel}`} nota={`${CANTERA[nivel].juveniles[0] === CANTERA[nivel].juveniles[1] ? CANTERA[nivel].juveniles[0] : CANTERA[nivel].juveniles.join("-")} juveniles por hornada · joya ${CANTERA[nivel].probabilidadJoya}`} />
            <Dato etiqueta="En la academia" valor={String(juveniles.length)} />
            <Dato etiqueta="Media del primer equipo" valor={formatoMedia(mediaEquipo)} />
            <Dato etiqueta="Fichas del primer equipo" valor={`${plantilla} de ${MERCADO_LOCAL.maximoPlantilla}`} />
          </div>
          <p className="mb-5 max-w-3xl text-sm text-suave">
            Los juveniles crecen cada semana hacia su potencial, que no se ve: la proyección es lo que cree el entrenador de cantera. Quien cumpla 19 años sin contrato profesional se
            marcha. Dar contrato ocupa una ficha del primer equipo.
          </p>
          {juveniles.length === 0 ? (
            <p className="text-sm text-suave">La academia está vacía. La próxima hornada llegará en el Día de la Cantera.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {juveniles.map((j) => (
                <li key={j.id} className="rounded-2xl border border-borde bg-superficie p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-semibold">
                      {j.nombre} {j.apellido}
                    </h2>
                    <span className="text-2xl font-bold tabular-nums">{formatoMedia(j.media)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-sm text-suave">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${COLOR_POSICION[j.posicion]}`}>{j.posicion}</span>
                    {j.edad} años · Proyección <strong className={j.proyeccion === "Excepcional" ? "text-cesped" : ""}>{j.proyeccion}</strong>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {j.listo ? <span className="rounded-full bg-cesped-suave px-2 py-0.5 font-semibold text-cesped">Listo para subir</span> : null}
                    {j.sale ? <span className="rounded-full bg-rival-suave px-2 py-0.5 font-semibold text-rival">Se va si no firma</span> : null}
                  </div>
                  <form action={decidirJuvenil} className="mt-4 flex gap-2 border-t border-borde pt-3">
                    <input type="hidden" name="juvenil" value={j.id} />
                    <button name="accion" value="subir" className="rounded-full bg-cesped px-4 py-1.5 text-sm font-semibold text-white dark:text-black">
                      Dar contrato
                    </button>
                    {j.edad >= FILIAL.edadMinima ? (
                      <button name="accion" value="filial" className="rounded-full border border-borde px-4 py-1.5 text-sm font-semibold">
                        Al filial
                      </button>
                    ) : null}
                    <button name="accion" value="liberar" className="rounded-full px-4 py-1.5 text-sm text-suave hover:underline">
                      Despedir
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
