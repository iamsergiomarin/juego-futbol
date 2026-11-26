"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Foco, PlanEntrenamiento } from "@/dominio/entrenamiento";
import type { Planteamiento } from "@/dominio/tactica";
import { modoLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";
import { jugarSiguienteJornada, pasarDia } from "@/servidor/liga";
import { ErrorMercado, ficharJugador, ponerEnVenta, renovarContrato } from "@/servidor/mercado";
import { ErrorGrada, publicarComunicado } from "@/servidor/grada";
import { darFicha, ErrorFilial, pasarAlFilial, volverALaAcademia } from "@/servidor/filial";
import { ErrorCantera, liberarJuvenil, subirJuvenil } from "@/servidor/cantera";
import { ErrorObra, iniciarObra } from "@/servidor/instalaciones";
import type { EdificioObra } from "@/dominio/reglas";
import { aceptarOferta, contraofertar, ErrorPatrocinio, rechazarOferta } from "@/servidor/patrocinio";
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

/**
 * Modo local: juega la siguiente jornada, solo una. No hay atajos para simular varias:
 * cada jornada trae su semana de entrenamiento, sus noticias y la reacción de la grada.
 * En el modo online esta acción no existe: los partidos se juegan a su hora.
 */
export async function avanzarJornadas(): Promise<void> {
  await miClub();
  try {
    await jugarSiguienteJornada();
  } catch (e) {
    // La jornada se juega en una transacción: si falla no queda nada a medias. Se muestra el motivo en pantalla.
    console.error("Error al jugar la jornada:", e);
    const motivo = e instanceof Error ? e.message : String(e);
    volver("/inicio", { error: `No se ha podido jugar la jornada: ${motivo}` });
  }
  revalidatePath("/", "layout");
  redirect("/inicio");
}

/** Pasa un día de entrenamiento (los días entre partidos se juegan de uno en uno). */
export async function avanzarDia(): Promise<void> {
  await miClub();
  await pasarDia();
  revalidatePath("/", "layout");
  redirect("/equipo/entrenamiento");
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

/** Respuesta a una oferta de patrocinio: aceptar, rechazar o contraofertar (una sola vez). */
export async function responderOferta(formulario: FormData): Promise<void> {
  const club = await miClub();
  const id = String(formulario.get("oferta"));
  const accion = String(formulario.get("accion"));
  const ruta = "/club/patrocinio";
  try {
    if (accion === "aceptar") {
      await aceptarOferta(club, id);
      volver(ruta, { ok: "Contrato firmado. La afición ya lo comenta en La Grada." });
    } else if (accion === "rechazar") {
      await rechazarOferta(club, id);
      volver(ruta, { ok: "Oferta rechazada." });
    } else {
      const subida = Number(accion.replace("contra", "")) / 100;
      const r = await contraofertar(club, id, subida);
      volver(ruta, r.aceptada ? { ok: `${r.marca} acepta la contraoferta: el contrato mejora.` } : { error: `${r.marca} no quiere pagar tanto y retira su oferta.` });
    }
  } catch (e) {
    if (e instanceof ErrorPatrocinio) volver(ruta, { error: e.message });
    throw e;
  }
}

export async function mejorarEdificio(formulario: FormData): Promise<void> {
  const club = await miClub();
  const tipo = String(formulario.get("edificio")) as EdificioObra;
  const origen = formulario.get("volver") === "/club/ciudad" ? "/club/ciudad" : "/club/instalaciones";
  try {
    await iniciarObra(club, tipo);
    volver(origen, { ok: "Obra en marcha. Terminará en cuanto se dispute la próxima jornada." });
  } catch (e) {
    if (e instanceof ErrorObra) volver(origen, { error: e.message });
    throw e;
  }
}

/** Cantera: dar contrato profesional a un juvenil o despedirlo de la academia. */
export async function decidirJuvenil(formulario: FormData): Promise<void> {
  const club = await miClub();
  const id = String(formulario.get("juvenil"));
  const ruta = formulario.get("volver") === "filial" ? "/equipo/filial" : "/equipo/cantera";
  try {
    if (formulario.get("accion") === "liberar") {
      await liberarJuvenil(club, id);
      volver(ruta, { ok: "El juvenil deja la academia." });
    }
    if (formulario.get("accion") === "filial") {
      await pasarAlFilial(club, id);
      volver(ruta, { ok: "El juvenil pasa al filial. Jugará la liga de los domingos." });
    }
    const nombre = await subirJuvenil(club, id, formulario.get("accion") === "sin_ficha");
    volver(ruta, { ok: `${nombre} firma su primer contrato profesional. ¡Uno de la casa!` });
  } catch (e) {
    if (e instanceof ErrorCantera || e instanceof ErrorFilial) volver(ruta, { error: e.message });
    throw e;
  }
}

/** El club habla en La Grada con su cuenta oficial. */
export async function publicarComoClub(formulario: FormData): Promise<void> {
  const club = await miClub();
  try {
    await publicarComunicado(club, String(formulario.get("texto") ?? ""));
    volver("/grada", { ok: "Comunicado publicado. La grada ya está contestando." });
  } catch (e) {
    if (e instanceof ErrorGrada) volver("/grada", { error: e.message });
    throw e;
  }
}

/** Filial: devolver a la academia o dar ficha a quien juega arriba sin ella. */
export async function gestionarFilial(formulario: FormData): Promise<void> {
  const club = await miClub();
  const id = String(formulario.get("id"));
  const ruta = "/equipo/filial";
  try {
    if (formulario.get("accion") === "ficha") {
      const nombre = await darFicha(club, id);
      volver(ruta, { ok: `${nombre} ya tiene ficha del primer equipo.` });
    }
    await volverALaAcademia(club, id);
    volver(ruta, { ok: "El jugador vuelve a la academia." });
  } catch (e) {
    if (e instanceof ErrorFilial) volver(ruta, { error: e.message });
    throw e;
  }
}
