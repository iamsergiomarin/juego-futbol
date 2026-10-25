import { formatoEuros, formatoMedia, NOMBRE_PERSONALIDAD, NOMBRE_POSICION } from "@/componentes/formato";
import { Dato } from "@/componentes/juego/Caja";
import { Pestanas, type Pestana } from "@/componentes/juego/Pestanas";
import { estadisticasPlantilla, fichaClub, managerLocal, type JugadorFicha } from "@/servidor/consultas";

export const dynamic = "force-dynamic";

const PESTANAS: Pestana[] = [
  { href: "/equipo", etiqueta: "Plantilla" },
  { href: "/equipo/alineacion", etiqueta: "Alineación y táctica", proximamente: true },
  { href: "/equipo/entrenamiento", etiqueta: "Entrenamiento", proximamente: true },
  { href: "/equipo/cantera", etiqueta: "Cantera", proximamente: true },
  { href: "/equipo/mercado", etiqueta: "Mercado", proximamente: true },
];

const COLOR_POSICION: Record<JugadorFicha["posicion"], string> = {
  POR: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  DEF: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  MED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  DEL: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
};

export default async function Equipo() {
  const manager = (await managerLocal())!;
  const [club, stats] = await Promise.all([fichaClub(manager.clubId), estadisticasPlantilla(manager.clubId)]);
  if (!club) return null;
  const media = club.plantilla.reduce((a, j) => a + j.media, 0) / club.plantilla.length;
  const edad = club.plantilla.reduce((a, j) => a + j.edad, 0) / club.plantilla.length;
  const valor = club.plantilla.reduce((a, j) => a + j.valor, 0);
  const salarios = club.plantilla.reduce((a, j) => a + j.salario, 0);
  const goleador = [...club.plantilla].sort((a, b) => (stats.get(b.id)?.goles ?? 0) - (stats.get(a.id)?.goles ?? 0))[0];
  const golesGoleador = stats.get(goleador?.id ?? "")?.goles ?? 0;

  return (
    <>
      <Pestanas titulo="Equipo" pestanas={PESTANAS} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato etiqueta="Media de la plantilla" valor={formatoMedia(media)} nota={`Edad media: ${formatoMedia(edad)} años`} />
        <Dato etiqueta="Valor de mercado" valor={formatoEuros(valor)} />
        <Dato etiqueta="Salarios de la plantilla" valor={formatoEuros(salarios)} nota="por temporada" />
        <Dato
          etiqueta="Máximo goleador"
          valor={golesGoleador > 0 ? `${goleador.nombre} ${goleador.apellido}` : "—"}
          nota={golesGoleador > 0 ? `${golesGoleador} goles en liga` : "Aún sin goles"}
        />
      </div>

      <section className="rounded-2xl border border-borde bg-superficie">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-suave">
                <th className="py-3 pr-2 pl-5 font-medium">#</th>
                <th className="px-2 py-3 font-medium">Jugador</th>
                <th className="px-2 py-3 font-medium">Pos.</th>
                <th className="px-2 py-3 text-right font-medium">Edad</th>
                <th className="px-2 py-3 text-right font-medium">Media</th>
                <th className="px-2 py-3 text-right font-medium" title="Partidos de liga como titular">PJ</th>
                <th className="px-2 py-3 text-right font-medium">Goles</th>
                <th className="px-2 py-3 font-medium">Carácter</th>
                <th className="px-2 py-3 text-right font-medium">Valor</th>
                <th className="px-2 py-3 text-right font-medium">Salario</th>
                <th className="py-3 pr-5 pl-2 text-right font-medium">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {club.plantilla.map((j) => {
                const s = stats.get(j.id);
                return (
                  <tr key={j.id} className="border-b border-borde/60 last:border-0 hover:bg-fondo/60">
                    <td className="py-2 pr-2 pl-5 tabular-nums text-suave">{j.dorsal}</td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">
                      {j.nombre} {j.apellido}
                    </td>
                    <td className="px-2 py-2">
                      <span title={NOMBRE_POSICION[j.posicion]} className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${COLOR_POSICION[j.posicion]}`}>
                        {j.posicion}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{j.edad}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatoMedia(j.media)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s?.partidos ?? 0}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s?.goles ?? 0}</td>
                    <td className="px-2 py-2 text-suave">{NOMBRE_PERSONALIDAD[j.personalidad] ?? j.personalidad}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatoEuros(j.valor)}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatoEuros(j.salario)}</td>
                    <td className="py-2 pr-5 pl-2 text-right whitespace-nowrap text-suave">Temp. {j.contratoHasta}</td>
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
