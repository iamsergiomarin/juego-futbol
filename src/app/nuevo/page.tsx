import { redirect } from "next/navigation";
import { modoLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { FormularioClub } from "./FormularioClub";

export const dynamic = "force-dynamic";

export default async function NuevoClub() {
  if (!modoLocal()) redirect("/prototipo");
  if (await managerLocal()) redirect("/inicio");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <p className="text-xs font-semibold tracking-widest text-suave uppercase">Temporada 1 · Quinta división</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Funda tu club</h1>
      <p className="mt-3 max-w-xl text-suave">
        Todo empieza en un campo modesto de 2.000 espectadores, con 22 jugadores, un cuerpo técnico básico y 500.000 € en
        caja. Lo demás hay que ganárselo en el césped.
      </p>
      <section className="mt-8 rounded-2xl border border-borde bg-superficie p-5 sm:p-8">
        <FormularioClub />
      </section>
    </main>
  );
}
