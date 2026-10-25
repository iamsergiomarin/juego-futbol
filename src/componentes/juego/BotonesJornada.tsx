"use client";

import { useFormStatus } from "react-dom";
import { avanzarJornadas } from "@/app/(juego)/acciones";

function Boton({ cantidad, children, principal }: { cantidad: number; children: React.ReactNode; principal?: boolean }) {
  const { pending, data } = useFormStatus();
  const esteBoton = pending && data?.get("cantidad") === String(cantidad);
  return (
    <button
      type="submit"
      name="cantidad"
      value={cantidad}
      disabled={pending}
      className={
        "rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-60 " +
        (principal ? "bg-cesped text-white dark:text-black" : "border border-borde bg-superficie hover:bg-fondo")
      }
    >
      {esteBoton ? "Jugando…" : children}
    </button>
  );
}

/** Modo local: el jugador decide cuándo avanza el calendario. */
export function BotonesJornada({ restantes }: { restantes: number }) {
  return (
    <form action={avanzarJornadas} className="flex flex-wrap items-center gap-2">
      <Boton cantidad={1} principal>
        Jugar la jornada
      </Boton>
      {restantes > 1 ? <Boton cantidad={Math.min(5, restantes)}>Simular {Math.min(5, restantes)} jornadas</Boton> : null}
      {restantes > 5 ? <Boton cantidad={restantes}>Hasta el final</Boton> : null}
    </form>
  );
}
