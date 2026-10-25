"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Foco, PlanEntrenamiento } from "@/dominio/entrenamiento";
import { LIGA } from "@/dominio/reglas";
import type { Planteamiento } from "@/dominio/tactica";
import { modoLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { jugarJornadas } from "@/servidor/liga";
import { ErrorMercado, ficharJugador, ponerEnVenta, renovarContrato } from "@/servidor/mercado";
import { ErrorPlanteamiento, guardarEntrenamiento, guardarPlanteamiento } from "@/servidor/plantilla";
import { ErrorTemporada, nuevaTemporada } from "@/servidor/temporada";

async function miClub(): Promise<string> {
  if (!modoLocal()) throw new Error("Solo disponible en el modo local.");
  const m = await managerLocal();
  if (!m) redirect("/nuevo");
  return m.clubId;
}

/** Vuelve a una pantalla con un aviso (correcto o error) en la dirección. */
function volver(ruta: string, aviso: { ok?: string; error?: string }): never {
  const q = new URLSearchParams(aviso as Record<string, string>);
  revalidatePath("/", "layout");
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}${q.toString()}`);
}

/** Modo local: juega una o varias jornadas y vuelve al inicio con los resultados. */
export async function avanzarJornadas(formulario: FormData): Promise<void> {
  await miClub();
  // "Hasta el final" incluye el playoff, que se crea al terminar la liga.
  const cantidad = Math.max(1, Math.min(LIGA.jornadas + 10, Number(formulario.get("cantidad")) || 1));
  await jugarJornadas(cantidad);
  revalidatePath("/", "layout");
  redirect("/inicio");
}

export async function empezarTemporada(): Promise<void> {
  const club = await miClub();
  try {
    await nuevaTemporada(club);
  } catch (e) {
    if (e instanceof ErrorTemporada) volver("/inicio", { error: e.message });
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/inicio");
}

export interface EstadoGuardado {
  ok?: string;
  error?: string;
}

export async function guardarAlineacion(_previo: EstadoGuardado, formulario: FormData): Promise<EstadoGuardado> {
  const club = await miClub();
  try {
    const p = JSON.parse(String(formulario.get("planteamiento"))) as Planteamiento;
    await guardarPlanteamiento(club, p);
  } catch (e) {
    if (e instanceof ErrorPlanteamiento) return { error: e.message };
    if (e instanceof SyntaxError) return { error: "No se pudo leer la alineación." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: "Alineación guardada. Se usará en los próximos partidos." };
}

export async function guardarPlanEntrenamiento(_previo: EstadoGuardado, formulario: FormData): Promise<EstadoGuardado> {
  const club = await miClub();
  try {
    const plan = JSON.parse(String(formulario.get("plan"))) as PlanEntrenamiento;
    const focos = JSON.parse(String(formulario.get("focos"))) as Record<string, Foco | null>;
    await guardarEntrenamiento(club, plan, focos);
  } catch (e) {
    if (e instanceof SyntaxError) return { error: "No se pudo leer el plan." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: "Plan de entrenamiento guardado." };
}

export async function fichar(formulario: FormData): Promise<void> {
  const club = await miClub();
  const jugador = String(formulario.get("jugador"));
  const volverA = String(formulario.get("volver") || "/equipo/mercado");
  try {
    const nombre = await ficharJugador(club, jugador, Number(formulario.get("temporadas")) || 1);
    volver(volverA, { ok: `${nombre} ya es jugador del club.` });
  } catch (e) {
    if (e instanceof ErrorMercado) volver(volverA, { error: e.message });
    throw e;
  }
}

export async function vender(formulario: FormData): Promise<void> {
  const club = await miClub();
  const jugador = String(formulario.get("jugador"));
  const precio = formulario.get("quitar") ? null : Number(String(formulario.get("precio")).replace(/\D/g, ""));
  try {
    await ponerEnVenta(club, jugador, precio);
    volver(`/jugador/${jugador}`, { ok: precio ? "En el mercado. Los clubes pueden pujar cuando la ventana esté abierta." : "Retirado del mercado." });
  } catch (e) {
    if (e instanceof ErrorMercado) volver(`/jugador/${jugador}`, { error: e.message });
    throw e;
  }
}

export async function renovar(formulario: FormData): Promise<void> {
  const club = await miClub();
  const jugador = String(formulario.get("jugador"));
  try {
    const hasta = await renovarContrato(club, jugador, Number(formulario.get("temporadas")) || 1);
    volver(`/jugador/${jugador}`, { ok: `Renovado hasta la temporada ${hasta}.` });
  } catch (e) {
    if (e instanceof ErrorMercado) volver(`/jugador/${jugador}`, { error: e.message });
    throw e;
  }
}
