/**
 * Patrocinio (puro y determinista): ofertas de marcas ficticias, contraoferta y liquidación de temporada.
 * Las cifras viven en `reglas.ts`.
 */
import type { Rng } from "@/motor";
import { uniforme } from "@/motor";
import { ESPACIOS_PATROCINIO, PATROCINIO, PERFILES_PATROCINIO, type EspacioPatrocinio, type PerfilPatrocinio } from "./reglas";

const MARCAS: Record<PerfilPatrocinio, string[]> = {
  local: ["Conservas Villalba", "Ferretería Los Hermanos", "Quesos de la Vega", "Talleres Montoya", "Lácteos Peñarroya", "Muebles Casa Alta", "Bodegas del Duero Viejo", "Reformas Garrido"],
  multinacional: ["Aurelia Global", "Nordvik Energy", "Kestrel Telecom", "Omnia Logistics", "Valtec Systems", "Brightpath Airlines", "Helvion Group"],
  apuestas: ["Gol Directo", "CuotaMax", "Apuesta Real 24", "Jugada Dorada", "Bet Estadio"],
};

export interface OfertaGenerada {
  espacio: EspacioPatrocinio;
  marca: string;
  perfil: PerfilPatrocinio;
  fijo: number;
  prima: number;
  objetivoPosicion: number;
  duracion: number;
  margen: number;
  renovacion: boolean;
}

export interface ParametrosOfertas {
  espacio: EspacioPatrocinio;
  presupuesto: number;
  /** 0-100. Más popularidad, mejores ofertas. */
  popularidad: number;
  rng: Rng;
  /** Marcas que no deben aparecer (la que se marchó descontenta, o la que ya patrocina el otro espacio). */
  excluidas?: string[];
  /** Marca satisfecha del contrato anterior: vuelve con una oferta al alza. */
  renovacion?: { marca: string; perfil: PerfilPatrocinio };
}

const redondear = (n: number) => Math.round(n / 1000) * 1000;

/** Importe de referencia del espacio en la división: lo que pagaría una marca normal. */
export function importeBase(presupuesto: number, espacio: EspacioPatrocinio): number {
  return presupuesto * ESPACIOS_PATROCINIO[espacio].fraccion;
}

/** Ofertas de pretemporada: una por perfil, más la renovación de la marca satisfecha si la hay. */
export function generarOfertas(p: ParametrosOfertas): OfertaGenerada[] {
  const base = importeBase(p.presupuesto, p.espacio);
  const visibilidad = 0.9 + 0.2 * (p.popularidad / 100);
  const excluidas = new Set(p.excluidas ?? []);
  const usadas = new Set<string>();
  const ofertas: OfertaGenerada[] = [];

  const crear = (perfil: PerfilPatrocinio, marca: string, alza: number, renovacion: boolean): OfertaGenerada => {
    const fijo = redondear(base * PERFILES_PATROCINIO[perfil].pago * visibilidad * uniforme(p.rng, 0.95, 1.05) * (1 + alza));
    return {
      espacio: p.espacio,
      marca,
      perfil,
      fijo,
      prima: redondear(fijo * PATROCINIO.primaObjetivo),
      objetivoPosicion: PATROCINIO.objetivoPosicion,
      duracion: 1 + Math.floor(p.rng() * PATROCINIO.duracionMaxima),
      margen: uniforme(p.rng, PATROCINIO.margenContraoferta[0], PATROCINIO.margenContraoferta[1]),
      renovacion,
    };
  };

  if (p.renovacion && !excluidas.has(p.renovacion.marca)) {
    usadas.add(p.renovacion.marca);
    ofertas.push(crear(p.renovacion.perfil, p.renovacion.marca, PATROCINIO.alzaRenovacion, true));
  }
  for (const perfil of Object.keys(PERFILES_PATROCINIO) as PerfilPatrocinio[]) {
    if (p.renovacion?.perfil === perfil && ofertas.length > 0) continue; // la renovación ya ocupa ese perfil
    const libres = MARCAS[perfil].filter((m) => !excluidas.has(m) && !usadas.has(m));
    if (libres.length === 0) continue;
    const marca = libres[Math.floor(p.rng() * libres.length)];
    usadas.add(marca);
    ofertas.push(crear(perfil, marca, 0, false));
  }
  return ofertas;
}

/** Contraoferta (una sola vez): si lo pedido cabe en el margen de la marca, mejora el contrato; si no, retira la oferta. */
export function resolverContraoferta(fijo: number, margen: number, subida: number): { aceptada: boolean; fijo: number } {
  if (subida <= margen) return { aceptada: true, fijo: redondear(fijo * (1 + subida)) };
  return { aceptada: false, fijo };
}

export interface LiquidacionPatrocinio {
  cobraPrima: boolean;
  satisfaccion: number;
  popularidad: number;
  /** El patrocinador rompe el contrato por descontento. */
  seMarcha: boolean;
}

/** Cierre de temporada de un contrato: prima por objetivo, satisfacción y efecto del perfil en la popularidad. */
export function liquidarContrato(c: { perfil: PerfilPatrocinio; satisfaccion: number; objetivoPosicion: number | null }, posicion: number): LiquidacionPatrocinio {
  const cumple = c.objetivoPosicion != null && posicion <= c.objetivoPosicion;
  const buena = posicion <= PATROCINIO.objetivoPosicion;
  const satisfaccion = Math.max(0, Math.min(100, c.satisfaccion + (cumple ? 12 : buena ? 4 : -10)));
  return {
    cobraPrima: cumple,
    satisfaccion,
    popularidad: PERFILES_PATROCINIO[c.perfil].popularidad,
    seMarcha: satisfaccion <= PATROCINIO.satisfaccionSeMarcha,
  };
}

/** Hueco sin patrocinador: rinde menos que un contrato. */
export function importeSinContrato(presupuesto: number, espacio: EspacioPatrocinio): number {
  return importeBase(presupuesto, espacio) * PATROCINIO.sinContrato;
}
