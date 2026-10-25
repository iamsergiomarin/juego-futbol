/**
 * Reglas de juego acordadas en el documento de diseño.
 * Todas las cifras económicas son de partida y se ajustarán tras las pruebas.
 */

export type NivelDivision = 0 | 1 | 2 | 3 | 4 | 5;

export interface Division {
  nivel: NivelDivision;
  nombre: string;
  grupos: number;
  /** Presupuesto anual orientativo, en euros del juego. */
  presupuesto: number;
  /** Media típica de un titular de la división. */
  mediaTipica: number;
  controlSalarial: "suave" | "intermedio" | "estricto";
  /** Masa salarial máxima como fracción de los ingresos. */
  limiteSalarial: number;
  /** Tope de puja u oferta como múltiplo del valor de mercado (null = sin límite). */
  topePrecio: number | null;
}

export const DIVISIONES: Division[] = [
  { nivel: 0, nombre: "Élite", grupos: 1, presupuesto: 60_000_000, mediaTipica: 8.5, controlSalarial: "estricto", limiteSalarial: 0.65, topePrecio: null },
  { nivel: 1, nombre: "Primera", grupos: 2, presupuesto: 40_000_000, mediaTipica: 7.5, controlSalarial: "estricto", limiteSalarial: 0.65, topePrecio: 4 },
  { nivel: 2, nombre: "Segunda", grupos: 4, presupuesto: 25_000_000, mediaTipica: 6.5, controlSalarial: "intermedio", limiteSalarial: 0.7, topePrecio: 2.5 },
  { nivel: 3, nombre: "Tercera", grupos: 8, presupuesto: 12_000_000, mediaTipica: 5.5, controlSalarial: "intermedio", limiteSalarial: 0.7, topePrecio: 2.5 },
  { nivel: 4, nombre: "Cuarta", grupos: 16, presupuesto: 5_000_000, mediaTipica: 4.5, controlSalarial: "suave", limiteSalarial: 0.75, topePrecio: 1.5 },
  { nivel: 5, nombre: "Quinta", grupos: 32, presupuesto: 2_000_000, mediaTipica: 3.5, controlSalarial: "suave", limiteSalarial: 0.75, topePrecio: 1.5 },
];

export const LIGA = {
  equiposPorGrupo: 20,
  jornadas: 38,
  ascensoDirecto: 1,
  /** Posiciones que juegan playoff (2º a 5º). */
  playoff: [2, 3, 4, 5],
  descensos: 3,
  semanasTemporada: 21,
  /** Humanos mínimos en Primera para desbloquear la Élite. */
  humanosParaElite: 30,
  /** Franja de la tabla en la que un mánager nuevo releva a un bot. */
  relevoBot: { desde: 8, hasta: 13 },
} as const;

/** 0 = domingo … 6 = sábado */
export const CALENDARIO = {
  liga: [1, 6],
  copa: [3],
  continental: [2],
  filial: [0],
  entrenamiento: [2, 4, 5, 0],
} as const;

export const BOTS = {
  variacionNivel: 0.1,
  nivelEnQuinta: 0.9,
  /** Nivel de los bots de relleno en copa (juegan con suplentes). */
  nivelEnCopa: 0.6,
  maximoPorcentajeEnLiga: 0.25,
} as const;

export const COPA = {
  humanosMinimos: 16,
  semanaFinal: 17,
} as const;

/** Media máxima fichable según el nivel de la dirección deportiva. La cantera propia no tiene tope. */
export const TOPE_DIRECCION_DEPORTIVA: Record<number, number> = { 1: 5, 2: 6, 3: 7, 4: 8, 5: 10 };

export const MERCADO = {
  comisionFederacion: 0.075,
  /** Valor de un titular típico como fracción del presupuesto de su división. */
  valorTitularTipico: 0.06,
  rangos: { suplente: [0.02, 0.03], titular: [0.05, 0.07], estrella: [0.15, 0.25] },
  salarioMedio: 0.025,
  duracionSubastaHoras: [24, 48],
} as const;

export const PATROCINIO = {
  frontal: 0.15,
  marcaDeportiva: 0.1,
} as const;

/** Duración máxima de obra: 48 horas. */
export const OBRAS_HORAS = {
  esquinaBasica: 6,
  esquinaMejorada: 12,
  quioscos: 12,
  gradaLateralOFondo: [12, 24],
  palcosVip: 24,
  videomarcador: 24,
  tribunaCubiertaSegundaPlanta: [36, 48],
} as const;

export const CANTERA: Record<number, { juveniles: [number, number]; probabilidadJoya: string }> = {
  1: { juveniles: [2, 2], probabilidadJoya: "muy baja" },
  2: { juveniles: [3, 3], probabilidadJoya: "baja" },
  3: { juveniles: [3, 4], probabilidadJoya: "media" },
  4: { juveniles: [4, 4], probabilidadJoya: "alta" },
  5: { juveniles: [4, 5], probabilidadJoya: "muy alta" },
};

export const PLANTILLA = {
  fichasPrimerEquipo: 25,
  edadFilialEnPrimerEquipo: 22,
  partidosParaQuedarseArriba: 10,
  maximoMayores23EnFilial: 3,
  minimoDisponibles: 16,
} as const;

/**
 * Economía de jornada. PROVISIONAL hasta diseñar en detalle taquilla, televisión y patrocinio:
 * calibrada para que un club de Quinta con la plantilla inicial cierre la temporada con algo de margen.
 */
export const ECONOMIA_JORNADA = {
  /** Hora de los partidos de liga (hora peninsular). */
  horaPartido: "21:00",
  /** Precio medio de la entrada por división (0 = Élite … 5 = Quinta). */
  precioEntrada: [55, 40, 30, 22, 16, 12],
  /** Gasto medio por espectador atendido en quioscos y bares. */
  gastoRestauracion: 4,
  /** Espectadores que puede atender cada punto de venta por partido. */
  aforoPorPuntoVenta: 600,
  /** Demanda de entradas: socios × factor + público ocasional. */
  demandaPorSocio: 1.5,
  publicoOcasional: 800,
  /** Fracción del presupuesto de la división que llega cada temporada por televisión (parte fija). */
  televisionFija: 0.3,
  /** Patrocinio base (frontal + marca deportiva) mientras no existan contratos. */
  patrocinioBase: 0.25,
} as const;

/** Punto de partida de un club recién creado en Quinta. */
export const CLUB_NUEVO = {
  /** Dinero en caja al empezar, como fracción del presupuesto de Quinta. */
  dineroInicial: 0.25,
  masaSocial: 500,
  popularidad: 50,
  /** Plantilla inicial por posición (22 jugadores). */
  plantilla: { POR: 3, DEF: 7, MED: 7, DEL: 5 },
  /** Grada principal del campo modesto con el que arranca todo club. */
  aforoInicial: 2000,
  /** Calidad (1-100) del personal básico con el que se empieza. */
  calidadPersonalBasico: [22, 35],
} as const;

export function division(nivel: NivelDivision): Division {
  return DIVISIONES[nivel];
}

/** Valor de mercado orientativo de un titular típico según su media. */
export function valorOrientativo(media: number): number {
  // Interpolación entre las medias típicas de cada división.
  const puntos = [...DIVISIONES].sort((a, b) => a.mediaTipica - b.mediaTipica);
  const valor = (d: Division) => d.presupuesto * MERCADO.valorTitularTipico;
  if (media <= puntos[0].mediaTipica) return Math.round(valor(puntos[0]) * (media / puntos[0].mediaTipica) ** 3);
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    if (media <= b.mediaTipica) {
      const t = (media - a.mediaTipica) / (b.mediaTipica - a.mediaTipica);
      return Math.round(valor(a) * (valor(b) / valor(a)) ** t);
    }
  }
  const ultimo = puntos[puntos.length - 1];
  return Math.round(valor(ultimo) * 1.6 ** ((media - ultimo.mediaTipica) / 0.5));
}
