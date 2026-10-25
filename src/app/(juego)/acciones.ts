"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LIGA } from "@/dominio/reglas";
import { modoLocal } from "@/servidor/bd";
import { jugarJornadas } from "@/servidor/liga";

/** Modo local: juega una o varias jornadas y vuelve al inicio con los resultados. */
export async function avanzarJornadas(formulario: FormData): Promise<void> {
  if (!modoLocal()) throw new Error("Solo disponible en el modo local.");
  const cantidad = Math.max(1, Math.min(LIGA.jornadas, Number(formulario.get("cantidad")) || 1));
  await jugarJornadas(cantidad);
  revalidatePath("/", "layout");
  redirect("/inicio");
}
