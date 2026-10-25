"use server";

import { redirect } from "next/navigation";
import { crearPartidaLocal, ErrorCreacion, validarClub, type DatosClubNuevo, type ErroresClub } from "@/servidor/mundo";

export interface EstadoFormulario {
  datos: DatosClubNuevo;
  errores: ErroresClub;
  error?: string;
}

export async function crearClub(_previo: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const leer = (k: string) => String(formulario.get(k) ?? "");
  const datos: DatosClubNuevo = {
    nombreManager: leer("nombreManager"),
    nombreClub: leer("nombreClub"),
    abreviatura: leer("abreviatura"),
    ciudad: leer("ciudad"),
    colorPrincipal: leer("colorPrincipal"),
    colorSecundario: leer("colorSecundario"),
  };
  const errores = validarClub(datos);
  if (Object.keys(errores).length > 0) return { datos, errores };
  try {
    await crearPartidaLocal(datos);
  } catch (e) {
    if (e instanceof ErrorCreacion) return { datos, errores: {}, error: e.message };
    throw e;
  }
  redirect("/inicio");
}
