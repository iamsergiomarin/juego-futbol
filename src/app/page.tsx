import { redirect } from "next/navigation";
import { modoLocal } from "@/servidor/bd";
import { managerLocal } from "@/servidor/consultas";

export const dynamic = "force-dynamic";

/** Puerta de entrada: crear el club la primera vez; después, al inicio. */
export default async function Inicio() {
  if (!modoLocal()) redirect("/prototipo");
  const manager = await managerLocal();
  redirect(manager ? "/inicio" : "/nuevo");
}
