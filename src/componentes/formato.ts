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
