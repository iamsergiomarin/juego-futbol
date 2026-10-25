import Link from "next/link";
import { redirect } from "next/navigation";
import { Escudo } from "@/componentes/Escudo";
import {
  formatoEntero,
  formatoEuros,
  formatoFecha,
  formatoMedia,
  NOMBRE_INSTALACION,
  NOMBRE_PERSONALIDAD,
  NOMBRE_POSICION,
  NOMBRE_PUESTO,
} from "@/componentes/formato";
import { modoLocal } from "@/servidor/bd";
import { fichaClub, managerLocal, type JugadorFicha } from "@/servidor/consultas";

export const dynamic = "force-dynamic";

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <p className="text-xs text-suave">{etiqueta}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
      {nota ? <p className="mt-0.5 text-xs text-suave">{nota}</p> : null}
    </div>
  );
}

function Seccion({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-borde bg-superficie p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{titulo}</h2>
        {extra}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const COLOR_POSICION: Record<JugadorFicha["posicion"], string> = {
  POR: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  DEF: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  MED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  DEL: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
};

export default async function Club() {
  if (!modoLocal()) redirect("/prototipo");
  const manager = await managerLocal();
  if (!manager) redirect("/nuevo");
  const club = await fichaClub(manager.clubId);
  if (!club) redirect("/nuevo");

  const mediaPlantilla = club.plantilla.reduce((a, j) => a + j.media, 0) / club.plantilla.length;
  const masaSalarial = club.plantilla.reduce((a, j) => a + j.salario, 0) + club.personal.reduce((a, p) => a + p.salario, 0);
  const valorPlantilla = club.plantilla.reduce((a, j) => a + j.valor, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 sm:grid-cols-[auto_1fr_auto] sm:gap-x-6">
        <Escudo principal={club.colorPrincipal} secundario={club.colorSecundario} texto={club.corto} tamano={72} />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-suave uppercase">
            {club.division} · Grupo {club.grupo} · Temporada {club.temporada.numero}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{club.nombre}</h1>
          <p className="mt-1 text-sm text-suave">
            {club.ciudad} · Mánager: {club.manager}
          </p>
        </div>
        <Link
          href="/prototipo"
          className="col-span-2 justify-self-start rounded-full border border-borde px-4 py-2 text-sm font-semibold hover:bg-superficie sm:col-span-1"
        >
          Probar el motor de partidos
        </Link>
      </header>

      <p className="mt-6 rounded-2xl bg-cesped-suave px-4 py-3 text-sm text-cesped">
        La liga arranca el {formatoFecha(club.temporada.inicio)}. El calendario y las jornadas llegan en la próxima versión.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato etiqueta="Caja" valor={formatoEuros(club.dinero)} />
        <Dato etiqueta="Masa salarial" valor={formatoEuros(masaSalarial)} nota="por temporada" />
        <Dato etiqueta="Media de la plantilla" valor={formatoMedia(mediaPlantilla)} nota={`Valor: ${formatoEuros(valorPlantilla)}`} />
        <Dato etiqueta="Estadio" valor={`${formatoEntero(club.aforo)} plazas`} nota={`${formatoEntero(club.masaSocial)} socios`} />
      </div>

      <div className="mt-6">
        <Seccion titulo="Plantilla" extra={<span className="text-sm text-suave">{club.plantilla.length} jugadores</span>}>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-suave">
                  <th className="py-2 pr-2 pl-5 font-medium sm:pl-6">#</th>
                  <th className="px-2 py-2 font-medium">Jugador</th>
                  <th className="px-2 py-2 font-medium">Pos.</th>
                  <th className="px-2 py-2 text-right font-medium">Edad</th>
                  <th className="px-2 py-2 text-right font-medium">Media</th>
                  <th className="px-2 py-2 font-medium">Carácter</th>
                  <th className="px-2 py-2 text-right font-medium">Valor</th>
                  <th className="px-2 py-2 text-right font-medium">Salario</th>
                  <th className="py-2 pr-5 pl-2 text-right font-medium sm:pr-6">Contrato</th>
                </tr>
              </thead>
              <tbody>
                {club.plantilla.map((j) => (
                  <tr key={j.id} className="border-b border-borde/60 last:border-0">
                    <td className="py-2 pr-2 pl-5 tabular-nums text-suave sm:pl-6">{j.dorsal}</td>
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
                    <td className="px-2 py-2 text-suave">{NOMBRE_PERSONALIDAD[j.personalidad] ?? j.personalidad}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatoEuros(j.valor)}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatoEuros(j.salario)}</td>
                    <td className="py-2 pr-5 pl-2 text-right tabular-nums whitespace-nowrap text-suave sm:pr-6">
                      Temp. {j.contratoHasta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Seccion titulo="Cuerpo técnico">
          <ul className="space-y-3">
            {club.personal.map((p) => (
              <li key={p.puesto} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-xs text-suave">{NOMBRE_PUESTO[p.puesto] ?? p.puesto} · Básico</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{p.calidad}</p>
                  <p className="text-xs text-suave">calidad</p>
                </div>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Instalaciones">
          <ul className="space-y-3 text-sm">
            {club.edificios.map((e) => (
              <li key={e.tipo}>
                <div className="flex items-center justify-between">
                  <span className={e.nivel === 0 ? "text-suave" : "font-medium"}>{NOMBRE_INSTALACION[e.tipo] ?? e.tipo}</span>
                  <span className="text-xs text-suave">{e.nivel === 0 ? "Sin construir" : `Nivel ${e.nivel}`}</span>
                </div>
                {e.areas.length > 0 ? (
                  <p className="mt-0.5 text-xs text-suave">
                    {e.areas.map((a) => `${NOMBRE_INSTALACION[a.tipo] ?? a.tipo} (${a.nivel})`).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Seccion>
      </div>

      <div className="mt-6">
        <Seccion titulo={`Rivales del grupo ${club.grupo}`} extra={<span className="text-sm text-suave">Media de cada plantilla</span>}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {club.rivales.map((r) => (
              <li key={r.nombre} className="flex items-center gap-3 text-sm">
                <Escudo principal={r.colorPrincipal} secundario={r.colorSecundario} texto={r.nombre.split(" ").at(-1)!.slice(0, 3)} tamano={28} titulo={r.nombre} />
                <span className="min-w-0 flex-1 truncate">{r.nombre}</span>
                <span className="tabular-nums text-suave">{formatoMedia(r.media)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </main>
  );
}
