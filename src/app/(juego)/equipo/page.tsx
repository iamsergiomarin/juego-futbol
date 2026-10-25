import Link from "next/link";
import { COLOR_POSICION, formatoEuros, formatoMedia, NOMBRE_PERSONALIDAD, NOMBRE_POSICION } from "@/componentes/formato";
import { Dato } from "@/componentes/juego/Caja";
import { Baja, CambiosSemana, Energia, Forma } from "@/componentes/juego/EstadoJugador";
import { Pestanas } from "@/componentes/juego/Pestanas";
import { bdLocal } from "@/servidor/bd";
import { estadisticasPlantilla, estadoTemporada, managerLocal } from "@/servidor/consultas";
import { jugadoresEstado } from "@/servidor/plantilla";
import { PESTANAS_EQUIPO } from "./pestanas";

export const dynamic = "force-dynamic";

export default async function Equipo() {
  const manager = (await managerLocal())!;
  const bd = await bdLocal();
  const [plantilla, stats, temporada] = await Promise.all([
    jugadoresEstado(bd, manager.clubId),
    estadisticasPlantilla(manager.clubId),
    estadoTemporada(),
  ]);
  const numero = temporada?.numero ?? 1;
  const media = plantilla.reduce((a, j) => a + j.media, 0) / plantilla.length;
  const edad = plantilla.reduce((a, j) => a + j.edad, 0) / plantilla.length;
  const valor = plantilla.reduce((a, j) => a + j.valor, 0);
  const lesionados = plantilla.filter((j) => j.jornadasLesion > 0).length;
  const energia = Math.round(100 - (plantilla.reduce((a, j) => a + j.cansancio, 0) / plantilla.length) * 100);
  const terminan = plantilla.filter((j) => j.contratoHasta != null && j.contratoHasta <= numero).length;

  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS_EQUIPO} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Dato etiqueta="Media de la plantilla" valor={formatoMedia(media)} nota={`${plantilla.length} jugadores · edad media ${formatoMedia(edad)}`} />
        <Dato etiqueta="Valor de mercado" valor={formatoEuros(valor)} />
        <Dato etiqueta="Energía media" valor={`${energia} %`} nota="Rota si baja del 75 %" tono={energia < 70 ? "negativo" : undefined} />
        <Dato etiqueta="Lesionados" valor={String(lesionados)} tono={lesionados > 2 ? "negativo" : undefined} />
        <Dato etiqueta="Contratos que terminan" valor={String(terminan)} nota={terminan > 0 ? "Renuévalos o se irán libres" : "Al final de esta temporada"} tono={terminan > 0 ? "negativo" : undefined} />
      </div>

      <section className="rounded-2xl border border-borde bg-superficie">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-suave">
                <th className="py-3 pr-2 pl-5 font-medium">#</th>
                <th className="px-2 py-3 font-medium">Jugador</th>
                <th className="px-2 py-3 font-medium">Pos.</th>
                <th className="px-2 py-3 text-right font-medium">Edad</th>
                <th className="px-2 py-3 text-right font-medium">Media</th>
                <th className="px-2 py-3 font-medium">Energía</th>
                <th className="px-2 py-3 text-center font-medium">Forma</th>
                <th className="px-2 py-3 text-right font-medium" title="Partidos de liga como titular">PJ</th>
                <th className="px-2 py-3 text-right font-medium">Goles</th>
                <th className="px-2 py-3 text-center font-medium" title="Puntos de atributo ganados o perdidos esta semana">Semana</th>
                <th className="px-2 py-3 font-medium">Carácter</th>
                <th className="px-2 py-3 text-right font-medium">Valor</th>
                <th className="px-2 py-3 text-right font-medium">Salario</th>
                <th className="py-3 pr-5 pl-2 text-right font-medium">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {plantilla.map((j) => {
                const s = stats.get(j.id);
                const termina = j.contratoHasta != null && j.contratoHasta <= numero;
                return (
                  <tr key={j.id} className={`border-b border-borde/60 last:border-0 hover:bg-fondo/60 ${j.jornadasLesion > 0 ? "opacity-70" : ""}`}>
                    <td className="py-2 pr-2 pl-5 tabular-nums text-suave">{j.dorsal}</td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">
                      <Link href={`/jugador/${j.id}`} className="hover:text-cesped hover:underline">
                        {j.nombre} {j.apellido}
                      </Link>
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        <Baja jornadas={j.jornadasLesion} tipo={j.tipoLesion} />
                        {j.precioVenta ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">En venta</span> : null}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span title={NOMBRE_POSICION[j.posicion]} className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${COLOR_POSICION[j.posicion]}`}>
                        {j.posicion}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{j.edad}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatoMedia(j.media)}</td>
                    <td className="px-2 py-2">
                      <Energia cansancio={j.cansancio} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Forma forma={j.forma} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{s?.partidos ?? 0}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s?.goles ?? 0}</td>
                    <td className="px-2 py-2 text-center">
                      <CambiosSemana cambios={j.cambiosSemana} />
                    </td>
                    <td className="px-2 py-2 text-suave">{NOMBRE_PERSONALIDAD[j.personalidad] ?? j.personalidad}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatoEuros(j.valor)}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatoEuros(j.salario)}</td>
                    <td className={`py-2 pr-5 pl-2 text-right whitespace-nowrap ${termina ? "font-semibold text-rival" : "text-suave"}`}>
                      {termina ? "Termina" : `Temp. ${j.contratoHasta}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
