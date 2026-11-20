"use client";

import { useFormStatus } from "react-dom";
import { avanzarJornadas } from "@/app/(juego)/acciones";

function Boton({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-cesped px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60 dark:text-black"
    >
      {pending ? "Jugando…" : texto}
    </button>
  );
}

/**
 * Avance del calendario. En el modo local el jugador juega la jornada cuando quiere, de una en una.
 * En el online nadie la adelanta: los partidos se disputan a su hora para todos.
 */
export function BotonesJornada({ local, cuando, texto = "Jugar la jornada" }: { local: boolean; cuando?: string; texto?: string }) {
  if (!local) {
    return <p className="text-sm text-suave first-letter:uppercase">{cuando ? `Se juega ${cuando}` : "Se juega a su hora"}, como para todos los clubes.</p>;
  }
  return (
    <form action={avanzarJornadas}>
      <Boton texto={texto} />
    </form>
  );
}
