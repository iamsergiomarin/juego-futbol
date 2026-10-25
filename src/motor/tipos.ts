export type Posicion = "POR" | "DEF" | "MED" | "DEL";

export const ATRIBUTOS_CAMPO = [
  "pase", "regate", "tiro", "control", "centros", "aereo", "entrada",
  "velocidad", "resistencia", "fuerza", "vision", "colocacion", "decision", "temple",
] as const;

export const ATRIBUTOS_PORTERO = [
  "reflejos", "blocaje", "salidas", "juegoPies", "resistencia", "temple", "decision",
] as const;

export type AtributoCampo = (typeof ATRIBUTOS_CAMPO)[number];
export type AtributoPortero = (typeof ATRIBUTOS_PORTERO)[number];
export type Atributo = AtributoCampo | AtributoPortero;

/** Atributos en escala 1-100. */
export type Atributos = Partial<Record<Atributo, number>>;

export interface JugadorPartido {
  id: string;
  nombre: string;
  posicion: Posicion;
  atributos: Atributos;
  /** Cansancio con el que llega al partido (0 = fresco, 1 = agotado). Por defecto, 0. */
  cansancioInicial?: number;
}

export type Mentalidad = "defensiva" | "equilibrada" | "ofensiva";
export type Presion = "baja" | "normal" | "alta";

export interface Tactica {
  mentalidad: Mentalidad;
  presion: Presion;
}

export type Lado = "local" | "visitante";

/** Orden dada durante el partido. Se aplica en la siguiente interrupción del juego. */
export type Orden =
  | { tipo: "tactica"; mentalidad?: Mentalidad; presion?: Presion }
  | { tipo: "cambio"; saleId: string; entraId: string };

/**
 * Instrucción condicional que el mánager deja preparada antes del partido.
 * Es un dato (se guarda en base de datos), no código.
 */
export interface Condicional {
  id: string;
  desdeMinuto: number;
  marcador: "perdiendo" | "empatando" | "ganando";
  accion: {
    mentalidad?: Mentalidad;
    presion?: Presion;
    cambio?: { salePosicion: Posicion; entraPosicion: Posicion };
  };
}

export interface EquipoPartido {
  id: string;
  nombre: string;
  titulares: JugadorPartido[];
  banquillo: JugadorPartido[];
  tactica: Tactica;
  /** 0-1: familiaridad con el sistema. Acorta el tiempo de adaptación tras un cambio. */
  familiaridad: number;
  condicionales: Condicional[];
  /** Si el segundo entrenador hace cambios por cansancio cuando el mánager no los hace. */
  segundoEntrenador: boolean;
}

export type TipoEvento =
  | "gol"
  | "ocasion"
  | "cambio"
  | "tactica"
  | "condicional"
  | "descanso"
  | "final";

export interface EventoPartido {
  minuto: number;
  tipo: TipoEvento;
  lado?: Lado;
  texto: string;
  xg?: number;
  jugadorId?: string;
}

export interface Estadisticas {
  goles: [number, number];
  tiros: [number, number];
  /** Porcentaje de posesión local y visitante. */
  posesion: [number, number];
  xg: [number, number];
}

export interface ResultadoPartido extends Estadisticas {
  eventos: EventoPartido[];
  /** Marcador al llegar al minuto 60 (útil para medir remontadas). */
  marcador60: [number, number];
  semilla: number;
  /** Cansancio al final del partido de cada jugador que llegó a jugar. */
  cansancioFinal: Record<string, number>;
  /** Jugadores que jugaron algún minuto. */
  participantes: string[];
}
