// "always": en español, Intl no agrupa por defecto las cifras de cuatro dígitos (2000 → 2.000).
const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const entero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });

export function formatoEuros(valor: number): string {
  return euros.format(valor);
}

export function formatoEntero(valor: number): string {
  return entero.format(valor);
}

export function formatoMedia(valor: number): string {
  return valor.toFixed(1).replace(".", ",");
}

export function formatoFecha(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const ZONA = "Europe/Madrid";

/** "sáb. 31 oct · 21:00" a partir de una marca de tiempo ISO. */
export function formatoFechaHora(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: ZONA });
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
  return `${dia} · ${hora}`;
}

/** "sábado, 31 de octubre" a partir de una marca de tiempo ISO. */
export function formatoDiaLargo(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
}

export function formatoSigno(valor: number): string {
  return `${valor > 0 ? "+" : ""}${formatoEuros(valor)}`;
}

export const NOMBRE_POSICION: Record<string, string> = {
  POR: "Portero",
  DEF: "Defensa",
  MED: "Centrocampista",
  DEL: "Delantero",
};

export const NOMBRE_PUESTO: Record<string, string> = {
  segundo_entrenador: "Segundo entrenador",
  preparador_fisico: "Preparador físico",
  ojeador: "Ojeador",
  medico: "Médico",
  fisioterapeuta: "Fisioterapeuta",
  entrenador_porteros: "Entrenador de porteros",
  analista: "Analista",
  entrenador_cantera: "Entrenador de cantera",
  entrenador_filial: "Entrenador del filial",
  psicologo: "Psicólogo",
  nutricionista: "Nutricionista",
};

export const NOMBRE_INSTALACION: Record<string, string> = {
  estadio: "Estadio",
  sede: "Sede del club",
  ciudad_deportiva: "Ciudad deportiva",
  centro_medico: "Centro médico",
  escuela_cantera: "Escuela de cantera",
  direccion_deportiva: "Dirección deportiva",
  oficina_ojeadores: "Oficina de ojeadores",
  campos_entrenamiento: "Campos de entrenamiento",
};

export const NOMBRE_PERSONALIDAD: Record<string, string> = {
  normal: "Normal",
  profesional: "Profesional",
  ambicioso: "Ambicioso",
  lider: "Líder",
  timido: "Tímido",
  conflictivo: "Conflictivo",
};

export const COLOR_POSICION: Record<"POR" | "DEF" | "MED" | "DEL", string> = {
  POR: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  DEF: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  MED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  DEL: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
};
