import type { Rng } from "@/motor";
import { GRADA } from "./reglas";
import {
  AFICION_BROMISTA,
  AFICION_OPTIMISTA,
  AFICION_PESIMISTA,
  AFICION_TACTICO,
  CLUB_OFICIAL,
  COLUMNISTA,
  PENA,
  PRENSA_CRONICA,
  PREVIA,
  RESPUESTA_AL_RIVAL,
  RIVAL_TROLL,
  type Banco,
  type Clase,
} from "./gradaTextos";
import { APELLIDOS, elegir, NOMBRES } from "./nombres";

export type { Clase } from "./gradaTextos";

export type TipoAutor = "aficion" | "pena" | "prensa" | "club" | "rival";
export type Tono = "positivo" | "negativo" | "neutro";
export type Rasgo = "optimista" | "pesimista" | "tactico" | "bromista" | "ultra" | "cronista" | "radio" | "polemico" | "oficial";

export interface VozNueva {
  tipo: Exclude<TipoAutor, "rival">;
  nombre: string;
  usuario: string;
  rasgo: Rasgo;
}
export interface Voz extends VozNueva {
  id: number;
}
export interface Autor {
  tipo: TipoAutor;
  nombre: string;
  usuario: string;
}
/** Una publicación por escribir. `respuestaA` es la posición (anterior) de la publicación a la que responde. */
export interface Borrador {
  autor: Autor;
  texto: string;
  tono: Tono;
  /** Cuánta gente la ve, de 0 a 1,5 (multiplica la audiencia del club). */
  alcance: number;
  respuestaA?: number;
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

type Variables = Record<string, string | number | undefined>;

/** Sustituye {marcas} y limpia espacios sobrantes. */
export function llenar(plantilla: string, vars: Variables): string {
  return plantilla
    .replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .trim();
}

export function formatoMiles(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const coma = (n: number) => n.toFixed(1).replace(".", ",");
const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const NOMBRE_POSICION = { POR: "portero", DEF: "defensa", MED: "centrocampista", DEL: "delantero" } as const;
export type PosicionGrada = keyof typeof NOMBRE_POSICION;

// -----------------------------------------------------------------------------
// Las voces de un club
// -----------------------------------------------------------------------------

const NOMBRES_PENA = ["Fondo Norte", "Los de Siempre", "Grada Joven", "Sector Siete", "La Vieja Guardia", "Ultras del Fondo"];
const RASGOS_AFICION: Rasgo[] = ["optimista", "pesimista", "tactico", "bromista"];

/** Crea las cuentas que forman la grada de un club: la oficial, la peña, cuatro aficionados y la prensa local. */
export function crearVoces(rng: Rng, club: { nombre: string; corto: string; ciudad: string }): VozNueva[] {
  const ciudad = club.ciudad || club.nombre;
  const voces: VozNueva[] = [{ tipo: "club", nombre: club.nombre, usuario: `@${slug(club.corto || club.nombre)}`, rasgo: "oficial" }];
  const pena = elegir(rng, NOMBRES_PENA);
  voces.push({ tipo: "pena", nombre: `Peña ${pena}`, usuario: `@${slug(pena)}_${slug(ciudad)}`, rasgo: "ultra" });
  const usados = new Set<string>();
  for (const rasgo of RASGOS_AFICION) {
    let nombre = elegir(rng, NOMBRES);
    let apellido = elegir(rng, APELLIDOS);
    while (usados.has(`${nombre}${apellido}`)) {
      nombre = elegir(rng, NOMBRES);
      apellido = elegir(rng, APELLIDOS);
    }
    usados.add(`${nombre}${apellido}`);
    voces.push({ tipo: "aficion", nombre: `${nombre} ${apellido}`, usuario: `@${slug(nombre)}${slug(apellido).slice(0, 6)}${10 + Math.floor(rng() * 89)}`, rasgo });
  }
  voces.push({ tipo: "prensa", nombre: `Crónica ${ciudad}`, usuario: `@cronica_${slug(ciudad)}`, rasgo: "cronista" });
  voces.push({ tipo: "prensa", nombre: `${ciudad} Deportes`, usuario: `@${slug(ciudad)}deportes`, rasgo: "radio" });
  const nombre = elegir(rng, NOMBRES);
  const apellido = elegir(rng, APELLIDOS);
  voces.push({ tipo: "prensa", nombre: `${nombre} ${apellido}`, usuario: `@${slug(nombre)}_${slug(apellido)}`, rasgo: "polemico" });
  return voces;
}

const buscar = (voces: Voz[], rasgo: Rasgo) => voces.find((v) => v.rasgo === rasgo);
const autorDe = (v: Voz): Autor => ({ tipo: v.tipo, nombre: v.nombre, usuario: v.usuario });

// -----------------------------------------------------------------------------
// Análisis de un partido
// -----------------------------------------------------------------------------

export type Resultado = "G" | "E" | "P";

export interface GolPartido {
  minuto: number;
  propio: boolean;
  jugador?: string;
}

export interface ContextoPartido {
  club: string;
  rival: string;
  rivalCorto: string;
  local: boolean;
  jornada: number;
  competicion: "liga" | "playoff";
  ronda: string | null;
  golesPropios: number;
  golesRivales: number;
  goles: GolPartido[];
  /** Posición en la tabla tras la jornada y puntos (solo liga). */
  posicion: number | null;
  puntos: number;
  equipos: number;
  /** Resultados de los últimos partidos, el más reciente primero (incluye este). */
  racha: Resultado[];
  lesionados: { nombre: string; tipo: string; jornadas: number }[];
  asistencia: number;
  aforo: number;
  /** Solo playoff: si el club pasa de ronda y si fue en los penaltis. */
  eliminatoria?: { pasa: boolean; penaltis: boolean };
}

export interface AnalisisPartido {
  clase: Clase;
  resultado: Resultado;
  margen: number;
  marcador: string;
  goleadores: { nombre: string; goles: number }[];
  rachaN: number;
  rachaTipo: Resultado;
  sinPerder: number;
  sinGanar: number;
}

const signo = (a: number, b: number): Resultado => (a > b ? "G" : a < b ? "P" : "E");

export function analizarPartido(ctx: ContextoPartido): AnalisisPartido {
  const resultado = signo(ctx.golesPropios, ctx.golesRivales);
  const margen = Math.abs(ctx.golesPropios - ctx.golesRivales);
  const ordenados = [...ctx.goles].sort((a, b) => a.minuto - b.minuto);
  let p = 0;
  let r = 0;
  let p84 = 0;
  let r84 = 0;
  let fueDetras = false;
  for (const g of ordenados) {
    if (g.propio) p++;
    else r++;
    if (r > p) fueDetras = true;
    if (g.minuto <= 84) [p84, r84] = [p, r];
  }
  const antes = signo(p84, r84);
  let clase: Clase;
  if (resultado === "G") clase = margen >= 3 ? "goleada" : antes !== "G" ? "agonia" : fueDetras ? "remontada" : "victoria";
  else if (resultado === "E") clase = ctx.golesPropios === 0 ? "empate0" : antes === "P" ? "empate_final" : "empate";
  else clase = margen >= 3 ? "derrota_dura" : antes !== "P" ? "derrota_tarde" : "derrota";

  const porJugador = new Map<string, number>();
  for (const g of ordenados) if (g.propio && g.jugador) porJugador.set(g.jugador, (porJugador.get(g.jugador) ?? 0) + 1);
  const goleadores = [...porJugador].map(([nombre, goles]) => ({ nombre, goles })).sort((a, b) => b.goles - a.goles);

  const [primero] = ctx.racha;
  let rachaN = 0;
  for (const x of ctx.racha) {
    if (x !== primero) break;
    rachaN++;
  }
  let sinPerder = 0;
  for (const x of ctx.racha) {
    if (x === "P") break;
    sinPerder++;
  }
  let sinGanar = 0;
  for (const x of ctx.racha) {
    if (x === "G") break;
    sinGanar++;
  }
  return {
    clase,
    resultado,
    margen,
    marcador: `${ctx.golesPropios}-${ctx.golesRivales}`,
    goleadores,
    rachaN,
    rachaTipo: primero ?? resultado,
    sinPerder,
    sinGanar,
  };
}

function destacado(a: AnalisisPartido, ctx: ContextoPartido): string {
  const [uno, dos] = a.goleadores;
  if (!uno) return "";
  if (uno.goles >= 3) return `Triplete de ${uno.nombre}.`;
  if (uno.goles === 2) return `Doblete de ${uno.nombre}.`;
  if (ctx.golesPropios === 1) return `El gol lo firmó ${uno.nombre}.`;
  if (dos) return `Marcaron ${uno.nombre} y ${dos.nombre}.`;
  return "";
}

// -----------------------------------------------------------------------------
// Reacciones a un partido
// -----------------------------------------------------------------------------

function ordenar<T>(rng: Rng, lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function escritor(rng: Rng, vars: Variables) {
  const lista: Borrador[] = [];
  return {
    lista,
    poner(voz: Voz | undefined, banco: string[] | undefined, alcance: number, tono: Tono, respuestaA?: number): number {
      if (!voz || !banco || banco.length === 0) return -1;
      lista.push({ autor: autorDe(voz), texto: llenar(elegir(rng, banco), vars), tono, alcance, respuestaA });
      return lista.length - 1;
    },
    ponerAutor(autor: Autor, banco: string[], alcance: number, tono: Tono, respuestaA?: number): number {
      lista.push({ autor, texto: llenar(elegir(rng, banco), vars), tono, alcance, respuestaA });
      return lista.length - 1;
    },
  };
}

/** Lo que dice la grada después de un partido. La cuenta oficial va primero: las demás cuelgan de ella. */
export function reaccionesPartido(ctx: ContextoPartido, voces: Voz[], rng: Rng): Borrador[] {
  const a = analizarPartido(ctx);
  const [uno] = a.goleadores;
  const resultadoTexto = ctx.local
    ? `${ctx.club} ${ctx.golesPropios}-${ctx.golesRivales} ${ctx.rival}`
    : `${ctx.rival} ${ctx.golesRivales}-${ctx.golesPropios} ${ctx.club}`;
  const vars: Variables = {
    club: ctx.club,
    rival: ctx.rival,
    marcador: a.marcador,
    resultado: resultadoTexto,
    destacado: destacado(a, ctx),
    goleador: uno?.nombre,
    n: a.rachaN,
    pos: ctx.posicion ?? "",
    puntos: ctx.puntos,
    jornada: ctx.jornada,
    etiqueta: ctx.competicion === "playoff" ? `Playoff ${ctx.ronda ?? ""}`.trim() : `J${ctx.jornada}`,
    ronda: ctx.ronda ?? "",
    asistencia: formatoMiles(ctx.asistencia),
  };
  const tono: Tono = a.resultado === "G" ? "positivo" : a.resultado === "P" ? "negativo" : "neutro";
  const b = escritor(rng, vars);

  // Cuenta oficial, con la respuesta del hincha rival y el contraataque de la afición.
  const oficial = b.poner(buscar(voces, "oficial"), CLUB_OFICIAL[a.resultado], 1, tono);
  if (oficial >= 0) {
    const troll = b.ponerAutor(
      { tipo: "rival", nombre: `Hincha de ${ctx.rival}`, usuario: `@hincha_${slug(ctx.rivalCorto || ctx.rival)}` },
      RIVAL_TROLL[a.resultado],
      0.45,
      "neutro",
      oficial,
    );
    b.poner(buscar(voces, a.resultado === "G" ? "optimista" : "bromista"), RESPUESTA_AL_RIVAL[a.resultado], 0.3, tono, troll);
  }

  // Prensa local
  b.poner(buscar(voces, "cronista"), PRENSA_CRONICA[a.clase], 0.85, tono);
  if (rng() < 0.75) b.poner(buscar(voces, "polemico"), COLUMNISTA[a.clase], 1.25, a.resultado === "G" ? "neutro" : "negativo");

  // Afición: tres de las cuatro cuentas opinan; la peña siempre.
  const bancos: Record<string, Banco> = { optimista: AFICION_OPTIMISTA, pesimista: AFICION_PESIMISTA, tactico: AFICION_TACTICO, bromista: AFICION_BROMISTA };
  for (const rasgo of ordenar(rng, RASGOS_AFICION).slice(0, 3)) {
    const t: Tono = rasgo === "pesimista" ? (a.resultado === "G" ? "neutro" : "negativo") : tono;
    b.poner(buscar(voces, rasgo), bancos[rasgo][a.clase], 0.5 + rng() * 0.25, t);
  }
  b.poner(buscar(voces, "ultra"), PENA[a.clase], 0.7, tono);

  extrasPartido(ctx, a, voces, rng, vars, b);
  return b.lista;
}

function extrasPartido(ctx: ContextoPartido, a: AnalisisPartido, voces: Voz[], rng: Rng, vars: Variables, b: ReturnType<typeof escritor>) {
  const cronista = buscar(voces, "cronista");
  const radio = buscar(voces, "radio");
  const optimista = buscar(voces, "optimista");
  const pesimista = buscar(voces, "pesimista");
  const bromista = buscar(voces, "bromista");
  const pena = buscar(voces, "ultra");
  const oficial = buscar(voces, "oficial");
  const [uno] = a.goleadores;

  // Goleadores
  if (uno && uno.goles >= 3) {
    b.poner(optimista, ["¡¡TRIPLETE de {goleador}!! Hay noches que pasan a la historia del club.", "Tres goles de {goleador}. Que le hagan una estatua."], 0.9, "positivo");
    b.poner(radio, ["{goleador} se va con el balón: triplete ante {rival}."], 0.8, "positivo");
  } else if (uno && uno.goles === 2) {
    b.poner(optimista, ["{goleador} está en estado de gracia. Doblete hoy. Que no se vaya nunca.", "Doblete de {goleador}: así da gusto ir al campo."], 0.6, "positivo");
  }

  // Rachas
  if (ctx.competicion === "liga") {
    if (a.rachaTipo === "G" && a.rachaN >= 3) {
      b.poner(pena, ["{n} victorias seguidas. Que nadie nos baje de esta nube.", "Van {n} victorias consecutivas. Esto empieza a ser serio."], 0.8, "positivo");
      b.poner(cronista, ["{club} encadena {n} victorias seguidas y se asienta en la zona alta."], 0.7, "positivo");
    } else if (a.rachaTipo === "P" && a.rachaN >= 3) {
      b.poner(cronista, ["CRISIS | {club} suma {n} derrotas consecutivas y ya es puesto {pos}."], 1, "negativo");
      b.poner(pesimista, ["{n} derrotas seguidas. Y todavía hay quien dice que no pasa nada.", "A este paso nos quedamos sin afición. {n} derrotas seguidas."], 0.8, "negativo");
    } else if (a.sinPerder >= 5 && a.rachaTipo !== "P") {
      b.poner(pena, ["{n} partidos sin perder. Aquí no se baja nadie."], 0.6, "positivo", undefined);
    } else if (a.sinGanar >= 5) {
      b.poner(cronista, ["{club} lleva {n} jornadas sin ganar y busca la victoria que cambie la dinámica."], 0.8, "negativo");
    }

    // Posición
    if (ctx.posicion === 1 && ctx.jornada >= 3) {
      b.poner(cronista, ["{club}, líder del grupo con {puntos} puntos tras la jornada {jornada}."], 0.9, "positivo");
      b.poner(bromista, ["Mirad la tabla. Mirad. Mirad otra vez. Sí, estamos primeros.", "Líderes. Que alguien me pellizque."], 0.7, "positivo");
    } else if (ctx.posicion && ctx.posicion >= 2 && ctx.posicion <= 5 && ctx.jornada >= 10 && rng() < 0.5) {
      b.poner(radio, ["{club} es {pos}.º y mira de cerca el playoff de ascenso."], 0.5, "neutro");
    } else if (ctx.posicion && ctx.posicion >= ctx.equipos - 2 && ctx.jornada >= 10) {
      b.poner(pesimista, ["Estamos en la zona baja. Que nadie se relaje.", "Último tercio de la tabla. Esto ya no es ninguna broma."], 0.7, "negativo");
    }
  }

  // Lesiones
  for (const l of ctx.lesionados.slice(0, 2)) {
    const v: Variables = { ...vars, lesionado: l.nombre, tipo: l.tipo, baja: l.jornadas === 1 ? "una jornada" : `${l.jornadas} jornadas` };
    b.lista.push({
      autor: oficial ? autorDe(oficial) : { tipo: "club", nombre: ctx.club, usuario: "@club" },
      texto: llenar("🏥 PARTE MÉDICO | {lesionado}: {tipo}. Baja estimada: {baja}.", v),
      tono: "negativo",
      alcance: 0.7,
    });
    if (pesimista) {
      b.lista.push({
        autor: autorDe(pesimista),
        texto: llenar(elegir(rng, ["Se lesiona {lesionado}. Con esta plantilla no nos podemos permitir otra baja.", "Otra lesión, y van… ya he perdido la cuenta. {lesionado}, a recuperarse."]), v),
        tono: "negativo",
        alcance: 0.55,
      });
    }
  }

  // Asistencia
  if (ctx.local && ctx.aforo > 0) {
    const ocupacion = ctx.asistencia / ctx.aforo;
    if (ocupacion >= 0.95) b.poner(pena, ["Lleno hasta la bandera: {asistencia} personas animando. Así da gusto."], 0.7, "positivo");
    else if (ocupacion < 0.5) b.poner(cronista, ["Gradas medio vacías ({asistencia} espectadores): {club} necesita reconectar con su gente."], 0.8, "negativo");
  }

  // Eliminatorias
  if (ctx.competicion === "playoff" && ctx.eliminatoria) {
    const pasa = ctx.eliminatoria.pasa;
    const por = ctx.eliminatoria.penaltis ? " en los penaltis" : "";
    b.lista.push({
      autor: cronista ? autorDe(cronista) : { tipo: "prensa", nombre: "Prensa", usuario: "@prensa" },
      texto: llenar(
        pasa
          ? `PLAYOFF | {club} supera la ronda ({ronda}) ante {rival}${por}: {resultado}. Cada vez más cerca del ascenso.`
          : `PLAYOFF | Se esfuma el sueño: {club} cae en {ronda} ante {rival}${por} ({resultado}).`,
        vars,
      ),
      tono: pasa ? "positivo" : "negativo",
      alcance: 1.2,
    });
  }
}

// -----------------------------------------------------------------------------
// Previa del siguiente partido
// -----------------------------------------------------------------------------

export interface ContextoPrevia {
  club: string;
  rival: string;
  rivalCorto: string;
  local: boolean;
  jornada: number;
  competicion: "liga" | "playoff";
  ronda: string | null;
  /** "El sábado a las 21:00". */
  cuando: string;
  posicion: number | null;
  puntos: number;
  jugados: number;
}

export function previaPartido(ctx: ContextoPrevia, voces: Voz[], rng: Rng): Borrador[] {
  const contexto =
    ctx.jugados === 0
      ? "Arranca la temporada."
      : ctx.posicion
        ? `El equipo llega ${ctx.posicion}.º con ${ctx.puntos} puntos.`
        : "";
  const vars: Variables = {
    club: ctx.club,
    rival: ctx.rival,
    jornada: ctx.jornada,
    ronda: ctx.ronda ?? "",
    cuando: ctx.cuando.charAt(0).toUpperCase() + ctx.cuando.slice(1),
    condicion: ctx.local ? "recibe a" : "visita a",
    contexto,
  };
  const b = escritor(rng, vars);
  b.poner(buscar(voces, "radio"), ctx.competicion === "playoff" ? PREVIA.prensaPlayoff : PREVIA.prensa, 0.7, "neutro");
  b.poner(buscar(voces, "oficial"), PREVIA.club, 0.8, "neutro");
  const rasgo = elegir(rng, RASGOS_AFICION);
  b.poner(buscar(voces, rasgo), PREVIA[rasgo as "optimista" | "pesimista" | "tactico" | "bromista"], 0.5, rasgo === "pesimista" ? "negativo" : "neutro");
  b.poner(buscar(voces, "ultra"), ctx.local ? PREVIA.penaLocal : PREVIA.penaVisitante, 0.6, "positivo");
  return b.lista;
}

// -----------------------------------------------------------------------------
// Acontecimientos del club: fichajes, ventas, renovaciones y temporada
// -----------------------------------------------------------------------------

export type EventoClub =
  | { tipo: "bienvenida"; club: string; manager: string; ciudad: string; division: string }
  | { tipo: "fichaje"; club: string; jugador: string; posicion: PosicionGrada; media: number; edad: number; libre: boolean; precio: number; mediaEquipo: number }
  | { tipo: "venta"; club: string; jugador: string; posicion: PosicionGrada; media: number; edad: number; precio: number; comprador: string; mediaEquipo: number }
  | { tipo: "renovacion"; club: string; jugador: string; media: number; hasta: number; mediaEquipo: number }
  | { tipo: "campeon"; club: string; puntos: number; division: string; siguiente: string }
  | { tipo: "playoff"; club: string; posicion: number }
  | { tipo: "ascenso"; club: string; division: string; siguiente: string }
  | { tipo: "eliminado"; club: string; ronda: string | null }
  | { tipo: "nueva_temporada"; club: string; numero: number; division: string }
  | { tipo: "patrocinio"; club: string; marca: string; espacio: string; perfil: "local" | "multinacional" | "apuestas"; temporadas: number; importe: number };

export interface ReaccionEvento {
  borradores: Borrador[];
  /** Cuánto cambia el ánimo de la grada. */
  animo: number;
}

/** Un jugador es estrella si supera claramente la media del equipo. */
export const esEstrella = (media: number, mediaEquipo: number) => media >= mediaEquipo + 0.4;

export function reaccionesEvento(ev: EventoClub, voces: Voz[], rng: Rng): ReaccionEvento {
  const optimista = buscar(voces, "optimista");
  const pesimista = buscar(voces, "pesimista");
  const tactico = buscar(voces, "tactico");
  const bromista = buscar(voces, "bromista");
  const pena = buscar(voces, "ultra");
  const oficial = buscar(voces, "oficial");
  const cronista = buscar(voces, "cronista");
  const radio = buscar(voces, "radio");
  const polemico = buscar(voces, "polemico");

  const vars: Variables = { club: ev.club };
  const b = escritor(rng, vars);
  let animo = 0;

  switch (ev.tipo) {
    case "bienvenida": {
      Object.assign(vars, { manager: ev.manager, ciudad: ev.ciudad, division: ev.division });
      b.poner(oficial, ["👋 BIENVENIDO | {manager} es el nuevo presidente de {club}. Una nueva etapa empieza hoy."], 1, "positivo");
      b.poner(cronista, ["Nueva etapa en {club}: {manager} asume la presidencia con el reto de hacer crecer al equipo desde {division}."], 0.8, "neutro");
      b.poner(optimista, ["¡Bienvenido, presidente {manager}! Con ganas de ver ese proyecto.", "Por fin ilusión en {club}. ¡Vamos, presidente!"], 0.6, "positivo");
      b.poner(pesimista, ["Otro presidente más. Ya veremos si cumple lo que promete.", "Esperaremos a ver los resultados antes de aplaudir."], 0.5, "neutro");
      b.poner(bromista, ["Bienvenido, presidente. La cerveza del descanso se paga aparte, avisado."], 0.5, "neutro");
      b.poner(pena, ["La peña da la bienvenida al presidente. Aquí le esperamos en el fondo."], 0.6, "positivo");
      break;
    }
    case "fichaje": {
      const estrella = esEstrella(ev.media, ev.mediaEquipo);
      const joven = ev.edad <= 21;
      Object.assign(vars, { jugador: ev.jugador, puesto: NOMBRE_POSICION[ev.posicion], media: coma(ev.media), edad: ev.edad, precio: formatoMiles(ev.precio) });
      b.poner(
        oficial,
        [ev.libre ? "🖊️ OFICIAL | {jugador} ({puesto}, {edad} años) llega a {club} como agente libre. ¡Bienvenido!" : "🖊️ OFICIAL | {jugador} ({puesto}, {edad} años) es nuevo jugador de {club}. ¡Bienvenido!"],
        1,
        "positivo",
      );
      b.poner(
        cronista,
        estrella
          ? ["Fichaje de relumbrón: {club} se refuerza con {jugador}, media {media}."]
          : joven
            ? ["{club} apuesta por {jugador}, {edad} años y futuro."]
            : ["{club} suma a {jugador} ({puesto}) para dar profundidad a la plantilla."],
        0.8,
        estrella ? "positivo" : "neutro",
      );
      b.poner(optimista, estrella ? ["¡{jugador}! ¡Por fin una buena noticia! Se nota que hay ambición.", "Ese sí que es un fichaje. ¡Vamos!"] : ["Bienvenido, {jugador}. Todo suma."], 0.6, "positivo");
      b.poner(pesimista, estrella ? ["Veremos si es tan bueno como dicen. A mí me convence cuando juegue."] : ["No me fío de otro fichaje sin ver cómo juega. Que demuestre."], 0.45, "neutro");
      b.poner(tactico, ["Un {puesto} con media {media} nos da otra opción táctica. Buena incorporación."], 0.5, "positivo");
      b.poner(bromista, ["Bienvenido, {jugador}. Aquí servimos buen bocadillo en el descanso."], 0.5, "neutro");
      animo = estrella ? 4 : joven ? 2 : 1;
      break;
    }
    case "venta": {
      const estrella = esEstrella(ev.media, ev.mediaEquipo);
      Object.assign(vars, { jugador: ev.jugador, puesto: NOMBRE_POSICION[ev.posicion], media: coma(ev.media), precio: formatoMiles(ev.precio), comprador: ev.comprador });
      b.poner(oficial, ["🔁 TRASPASO | {jugador} deja {club} rumbo a {comprador}. Gracias por todo."], 1, "neutro");
      b.poner(
        cronista,
        estrella
          ? ["Operación polémica: {club} vende a {jugador}, uno de sus mejores jugadores, por {precio} €."]
          : ["{club} ingresa {precio} € por el traspaso de {jugador} a {comprador}."],
        0.8,
        estrella ? "negativo" : "neutro",
      );
      if (estrella) {
        b.poner(pesimista, ["¿Vendéis a {jugador}? ¿Con qué vamos a competir ahora?", "Venden a {jugador} y nos dicen que hay ambición. Esto no tiene sentido."], 0.85, "negativo");
        b.poner(pena, ["La peña no está de acuerdo con la venta de {jugador}. Queremos explicaciones."], 0.8, "negativo");
        b.poner(polemico, ["Vender a {jugador} puede ser una buena operación económica, pero es una mala señal deportiva. Y la afición lo nota."], 1.2, "negativo");
      } else {
        b.poner(optimista, ["Es dinero para reforzar. Confío en el club."], 0.45, "neutro");
        b.poner(bromista, ["Se va {jugador}. Mucha suerte, crack."], 0.45, "neutro");
      }
      animo = estrella ? -5 : 0;
      break;
    }
    case "renovacion": {
      const estrella = esEstrella(ev.media, ev.mediaEquipo);
      Object.assign(vars, { jugador: ev.jugador, hasta: ev.hasta });
      b.poner(oficial, ["✍️ RENOVACIÓN | {jugador} seguirá en {club} hasta la temporada {hasta}."], 1, "positivo");
      b.poner(optimista, ["Renovar a {jugador} es una gran noticia. ¡Seguimos!", "{jugador} se queda. Eso es empezar a construir."], 0.55, "positivo");
      if (estrella) b.poner(cronista, ["{club} blinda a {jugador} hasta la temporada {hasta}: una de las piezas clave del proyecto."], 0.8, "positivo");
      animo = estrella ? 2 : 1;
      break;
    }
    case "campeon": {
      Object.assign(vars, { puntos: ev.puntos, division: ev.division, siguiente: ev.siguiente });
      b.poner(oficial, ["🏆 ¡CAMPEONES! {club} es campeón de {division} con {puntos} puntos. ¡Gracias, afición! 💚"], 1.5, "positivo");
      b.poner(cronista, ["Temporada histórica: {club} gana el grupo ({puntos} puntos) y asciende a {siguiente}."], 1.2, "positivo");
      b.poner(pena, ["¡¡¡CAMPEONES!!! Esta noche no duerme nadie en el fondo."], 1.3, "positivo");
      b.poner(optimista, ["Lo dije en agosto. ¡Y a por la siguiente categoría!"], 0.9, "positivo");
      b.poner(bromista, ["Lo dije en agosto. Bueno, lo dije por si acaso… pero lo dije."], 0.9, "positivo");
      b.poner(pesimista, ["Vale, lo reconozco: me equivoqué con mis pronósticos. Mejor así."], 0.8, "positivo");
      animo = 20;
      break;
    }
    case "playoff": {
      Object.assign(vars, { pos: ev.posicion });
      b.poner(cronista, ["{club} acaba {pos}.º y jugará el playoff de ascenso. Semifinal a partido único."], 1, "neutro");
      b.poner(optimista, ["¡Al playoff! Aún queda la última bala. ¡A por ello!"], 0.7, "positivo");
      b.poner(pesimista, ["Playoff a partido único. Con nuestra suerte, mejor no hacerse ilusiones."], 0.5, "neutro");
      b.poner(pena, ["El fondo ya está preparando el recibimiento para el playoff."], 0.7, "positivo");
      animo = 3;
      break;
    }
    case "ascenso": {
      Object.assign(vars, { division: ev.division, siguiente: ev.siguiente });
      b.poner(oficial, ["🎉 ¡ASCENSO! {club} subimos a {siguiente}. ¡Gracias, afición!"], 1.5, "positivo");
      b.poner(cronista, ["{club} sube de categoría tras ganar el playoff: la próxima temporada, {siguiente}."], 1.2, "positivo");
      b.poner(pena, ["¡¡ASCENSO!! Nadie lo olvidará. ¡La peña estará siempre!"], 1.3, "positivo");
      b.poner(bromista, ["Ya puedo morirme tranquilo. Bueno, mañana, que hay cena."], 0.9, "positivo");
      animo = 15;
      break;
    }
    case "eliminado": {
      Object.assign(vars, { ronda: ev.ronda ?? "el playoff" });
      b.poner(cronista, ["Se esfuma el ascenso: {club} cae en {ronda} y se queda otro año en la categoría."], 1.1, "negativo");
      b.poner(pesimista, ["Otra vez nos quedamos a las puertas. Ya me lo temía."], 0.8, "negativo");
      b.poner(pena, ["Orgullosos igualmente. El año que viene, otra vez."], 0.8, "neutro");
      b.poner(optimista, ["Duele, pero estamos más cerca que nunca. Vamos a por la próxima."], 0.6, "neutro");
      animo = -6;
      break;
    }
    case "patrocinio": {
      Object.assign(vars, { marca: ev.marca, espacio: ev.espacio.toLowerCase(), temporadas: ev.temporadas, importe: formatoMiles(ev.importe) });
      b.poner(oficial, ["🤝 PATROCINIO | {marca} será {espacio} de {club} durante {temporadas} temporada(s). ¡Bienvenidos a la familia!"], 1, "positivo");
      b.poner(cronista, ["{club} cierra un acuerdo con {marca} ({importe} € al año) para el {espacio}."], 0.8, "neutro");
      if (ev.perfil === "apuestas") {
        b.poner(pesimista, ["¿Una casa de apuestas en la camiseta? Dinero es dinero, pero no me gusta."], 0.8, "negativo");
        b.poner(polemico, ["{club} vende su imagen a una casa de apuestas. Los números cuadran; el símbolo, mucho menos."], 1.1, "negativo");
        animo = -2;
      } else if (ev.perfil === "local") {
        b.poner(optimista, ["Una empresa de aquí, de la tierra. ¡Eso sí que es sentirse club!"], 0.7, "positivo");
        b.poner(pena, ["Que sea una marca de casa nos gusta. Pasaremos a saludar."], 0.6, "positivo");
        animo = 2;
      } else {
        b.poner(optimista, ["Más músculo económico para el club. ¡Bien!"], 0.5, "positivo");
        b.poner(bromista, ["Ya podemos comprar balones nuevos. Y quizá un banderín."], 0.5, "neutro");
        animo = 1;
      }
      break;
    }
    case "nueva_temporada": {
      Object.assign(vars, { numero: ev.numero, division: ev.division });
      b.poner(oficial, ["🔔 ARRANCA la temporada {numero}. {club} jugará en {division}. ¡Todos juntos!"], 1, "positivo");
      b.poner(optimista, ["Nueva temporada, nuevas ilusiones. ¡Vamos!"], 0.6, "positivo");
      b.poner(pesimista, ["A ver cuánto dura la ilusión esta vez."], 0.45, "neutro");
      b.poner(bromista, ["Mi abono ya está pagado. Mi cordura, no."], 0.55, "neutro");
      b.poner(radio, ["Empieza la temporada {numero} en {division}: {club} quiere dar el salto."], 0.6, "neutro");
      animo = 5;
      break;
    }
  }
  return { borradores: b.lista, animo };
}

// -----------------------------------------------------------------------------
// Ánimo de la grada
// -----------------------------------------------------------------------------

const DELTA_PARTIDO: Record<Clase, number> = {
  goleada: 8,
  victoria: 5,
  agonia: 7,
  remontada: 8,
  empate: 0,
  empate_final: 2,
  empate0: -1,
  derrota: -6,
  derrota_dura: -10,
  derrota_tarde: -7,
};

export function animoTrasPartido(animo: number, clase: Clase, local: boolean): number {
  // Con el tiempo el ánimo vuelve hacia el punto neutro, al menos un punto por jornada.
  const distancia = GRADA.animoNeutro - animo;
  const paso = distancia === 0 ? 0 : Math.sign(distancia) * Math.min(Math.abs(distancia), Math.ceil(Math.abs(distancia) * GRADA.regresionPorJornada));
  let a = animo + paso + DELTA_PARTIDO[clase];
  if (local && clase === "empate") a -= 1;
  return limitar(Math.round(a), 0, 100);
}

export function animoTrasEvento(animo: number, delta: number): number {
  return limitar(Math.round(animo + delta), 0, 100);
}

export function etiquetaAnimo(animo: number): { texto: string; tono: Tono } {
  if (animo >= 85) return { texto: "Eufórica", tono: "positivo" };
  if (animo >= 70) return { texto: "Entregada", tono: "positivo" };
  if (animo >= 55) return { texto: "Contenta", tono: "positivo" };
  if (animo >= 40) return { texto: "Inquieta", tono: "neutro" };
  if (animo >= 25) return { texto: "Enfadada", tono: "negativo" };
  return { texto: "Pide cambios", tono: "negativo" };
}

/** Efecto del ánimo en la demanda de entradas (1 = neutro). */
export function factorTaquilla(animo: number): number {
  return limitar(1 + (animo - GRADA.animoInicial) * GRADA.taquillaPorPunto, GRADA.taquillaMinima, GRADA.taquillaMaxima);
}

/** Me gusta, comentarios y compartidos de una publicación según el alcance y el tamaño de la afición. */
export function reacciones(rng: Rng, alcance: number, masaSocial: number, animo: number): { meGusta: number; comentarios: number; compartidos: number } {
  const seguidores = Math.max(40, masaSocial * GRADA.seguidoresPorSocio * 6);
  const interes = 0.35 + (animo / 100) * 0.5;
  const base = seguidores * alcance * interes * (0.4 + rng() * 1.2) * 0.35;
  const meGusta = Math.max(0, Math.round(base));
  return { meGusta, comentarios: Math.round(meGusta * (0.05 + rng() * 0.12)), compartidos: Math.round(meGusta * (0.03 + rng() * 0.1)) };
}
