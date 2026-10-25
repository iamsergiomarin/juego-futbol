import type { Transaction } from "@electric-sql/pglite";
import { crearRng, gauss, generarJugador, mediaJugador, semillaAleatoria, uniforme, type Posicion, type Rng } from "@/motor";
import { BOTS, CLUB_NUEVO, LIGA, division, type NivelDivision } from "@/dominio/reglas";
import { coloresBot, elegir, nombreJugador, nombresClubes } from "@/dominio/nombres";
import { MERCADO_LOCAL, salarioReferencia, valorJugador } from "@/dominio/mercado";
import { bdLocal } from "./bd";
import { asegurarCalendario } from "./liga";

/** Datos que el jugador elige al crear su club. */
export interface DatosClubNuevo {
  nombreManager: string;
  nombreClub: string;
  abreviatura: string;
  ciudad: string;
  colorPrincipal: string;
  colorSecundario: string;
}

export type ErroresClub = Partial<Record<keyof DatosClubNuevo, string>>;

const COLOR = /^#[0-9a-fA-F]{6}$/;

export function validarClub(d: DatosClubNuevo): ErroresClub {
  const e: ErroresClub = {};
  if (d.nombreManager.trim().length < 2 || d.nombreManager.trim().length > 40) e.nombreManager = "Entre 2 y 40 caracteres.";
  if (d.nombreClub.trim().length < 3 || d.nombreClub.trim().length > 40) e.nombreClub = "Entre 3 y 40 caracteres.";
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,4}$/.test(d.abreviatura.trim())) e.abreviatura = "De 2 a 4 letras.";
  if (d.ciudad.trim().length < 2 || d.ciudad.trim().length > 40) e.ciudad = "Entre 2 y 40 caracteres.";
  if (!COLOR.test(d.colorPrincipal)) e.colorPrincipal = "Color no válido.";
  if (!COLOR.test(d.colorSecundario)) e.colorSecundario = "Color no válido.";
  else if (d.colorPrincipal.toLowerCase() === d.colorSecundario.toLowerCase()) e.colorSecundario = "Elige un color distinto al principal.";
  return e;
}

/** Lunes siguiente a la fecha dada (la temporada arranca en lunes, día de liga). */
export function proximoLunes(desde: Date): Date {
  const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  const dias = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

export const isoFecha = (d: Date) => d.toISOString().slice(0, 10);

const PERSONALIDADES = [
  ["normal", 40], ["profesional", 20], ["ambicioso", 12], ["lider", 8], ["timido", 12], ["conflictivo", 8],
] as const;

function personalidad(rng: Rng): string {
  let r = rng() * 100;
  for (const [p, peso] of PERSONALIDADES) {
    r -= peso;
    if (r <= 0) return p;
  }
  return "normal";
}

export interface JugadorNuevo {
  nombre: string;
  apellido: string;
  nacimiento: string;
  posicion: Posicion;
  atributos: Record<string, number>;
  media: number;
  potencial: number;
  personalidad: string;
  contratoHasta: number | null;
  salario: number;
  valor: number;
  dorsal: number | null;
}

/** Un jugador nuevo con la media objetivo, edad realista, potencial, salario y valor. */
export function crearJugador(
  rng: Rng,
  posicion: Posicion,
  nivel: number,
  inicioTemporada: Date,
  temporada: number,
  divisionNivel: NivelDivision,
  edadMedia = 25,
): JugadorNuevo {
  const edad = Math.round(Math.min(35, Math.max(17, gauss(rng, edadMedia, 4))));
  const nacimiento = new Date(inicioTemporada);
  nacimiento.setUTCFullYear(nacimiento.getUTCFullYear() - edad);
  nacimiento.setUTCDate(nacimiento.getUTCDate() - Math.floor(rng() * 365));
  const j = generarJugador(rng, "", "", posicion, Math.max(1, nivel));
  const atributos = j.atributos as Record<string, number>;
  const media = mediaJugador(atributos);
  const extra = edad <= 22 ? uniforme(rng, 5, 30) : edad <= 26 ? uniforme(rng, 0, 12) : uniforme(rng, 0, 4);
  return {
    ...nombreJugador(rng),
    nacimiento: isoFecha(nacimiento),
    posicion,
    atributos,
    media,
    potencial: Math.round(Math.min(100, media * 10 + extra)),
    personalidad: personalidad(rng),
    contratoHasta: temporada + 1 + Math.floor(rng() * 3),
    salario: salarioReferencia(media, divisionNivel),
    valor: valorJugador(media, edad),
    dorsal: null,
  };
}

/** Plantilla de 22 jugadores con la media objetivo y dorsales del 1 al 22 (porteros 1, 13 y 25). */
export function generarPlantilla(rng: Rng, nivel: number, inicio: Date, temporada: number, divisionNivel: NivelDivision = 5): JugadorNuevo[] {
  const posiciones: Posicion[] = [];
  for (const [pos, n] of Object.entries(CLUB_NUEVO.plantilla) as [Posicion, number][]) {
    for (let i = 0; i < n; i++) posiciones.push(pos);
  }
  const dorsalesPortero = [1, 13, 25];
  let siguienteDorsal = 2;
  let porteros = 0;
  const usados = new Set<string>();
  return posiciones.map((posicion) => {
    const j = crearJugador(rng, posicion, gauss(rng, nivel, 0.35), inicio, temporada, divisionNivel);
    // Sin homónimos en el mismo vestuario: confunden en la alineación.
    for (let intento = 0; usados.has(`${j.nombre} ${j.apellido}`) && intento < 20; intento++) Object.assign(j, nombreJugador(rng));
    usados.add(`${j.nombre} ${j.apellido}`);
    if (posicion === "POR") j.dorsal = dorsalesPortero[porteros++];
    else {
      if (siguienteDorsal === 13) siguienteDorsal++;
      j.dorsal = siguienteDorsal++;
    }
    return j;
  });
}

/** Inserta jugadores en un club (o como agentes libres si `clubId` es null). */
export async function insertarJugadores(tx: Transaction, clubId: string | null, jugadores: JugadorNuevo[]) {
  if (jugadores.length === 0) return;
  const columnas = 13;
  const valores: unknown[] = [];
  const filas = jugadores.map((j, i) => {
    valores.push(
      clubId, j.nombre, j.apellido, j.nacimiento, j.posicion, JSON.stringify(j.atributos), j.media,
      j.potencial, j.personalidad, j.contratoHasta, j.salario, j.valor, j.dorsal,
    );
    const b = i * columnas;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::posicion, $${b + 6}::jsonb, $${b + 7}, $${b + 8}, $${b + 9}::personalidad, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13})`;
  });
  await tx.query(
    `insert into jugadores (club_id, nombre, apellido, fecha_nacimiento, posicion, atributos, media, potencial,
       personalidad, contrato_hasta, salario, valor_mercado, dorsal) values ${filas.join(", ")}`,
    valores,
  );
}

/** Agentes libres: jugadores sin club que se pueden fichar sin pagar traspaso. */
export async function generarAgentesLibres(
  tx: Transaction,
  rng: Rng,
  nivel: number,
  cantidad: number,
  inicio: Date,
  temporada: number,
  divisionNivel: NivelDivision,
) {
  const posiciones: Posicion[] = ["POR", "DEF", "DEF", "DEF", "MED", "MED", "MED", "DEL", "DEL"];
  const jugadores = Array.from({ length: cantidad }, () => {
    // Variedad: veteranos baratos, jóvenes con proyección y algún jugador hecho.
    const perfil = rng();
    const edadMedia = perfil < 0.3 ? 20 : perfil < 0.75 ? 26 : 31;
    const j = crearJugador(rng, elegir(rng, posiciones), nivel * uniform(rng, 0.8, 1.15), inicio, temporada, divisionNivel, edadMedia);
    return { ...j, contratoHasta: null };
  });
  await insertarJugadores(tx, null, jugadores);
}

const uniform = uniforme;

/** Estadio, edificios e instalaciones con los que arranca todo club. */
async function insertarInstalaciones(tx: Transaction, clubId: string) {
  const sectores: [string, number, number, number][] = [
    // sector, nivel, aforo, puntos de venta
    ["tribuna", 1, CLUB_NUEVO.aforoInicial, 2],
    ["fondo_norte", 0, 0, 0],
    ["fondo_sur", 0, 0, 0],
    ["lateral", 0, 0, 0],
    ["esquinas", 0, 0, 0],
    ["cesped", 1, 0, 0],
  ];
  for (const [sector, nivel, aforo, puntos] of sectores) {
    await tx.query(
      "insert into sectores_estadio (club_id, sector, nivel, aforo, puntos_venta) values ($1, $2, $3, $4, $5)",
      [clubId, sector, nivel, aforo, puntos],
    );
  }
  const edificios: [string, number, [string, number][]][] = [
    ["estadio", 1, []],
    ["sede", 1, [["direccion_deportiva", 1], ["oficina_ojeadores", 1]]],
    ["ciudad_deportiva", 1, [["campos_entrenamiento", 1]]],
    ["centro_medico", 0, []],
    ["escuela_cantera", 0, []],
  ];
  for (const [tipo, nivel, areas] of edificios) {
    const { rows } = await tx.query<{ id: string }>(
      "insert into edificios (club_id, tipo, nivel) values ($1, $2::tipo_edificio, $3) returning id",
      [clubId, tipo, nivel],
    );
    for (const [area, nivelArea] of areas) {
      await tx.query("insert into areas (edificio_id, tipo, nivel) values ($1, $2, $3)", [rows[0].id, area, nivelArea]);
    }
  }
}

async function insertarPersonalBasico(tx: Transaction, rng: Rng, clubId: string, temporada: number) {
  const [min, max] = CLUB_NUEVO.calidadPersonalBasico;
  for (const puesto of ["segundo_entrenador", "preparador_fisico", "ojeador"]) {
    const { nombre, apellido } = nombreJugador(rng);
    const calidad = Math.round(uniforme(rng, min, max));
    await tx.query(
      `insert into personal (club_id, nombre, puesto, categoria, calidad, salario, contrato_hasta)
       values ($1, $2, $3::puesto_personal, 'basico', $4, $5, $6)`,
      [clubId, `${nombre} ${apellido}`, puesto, calidad, 20_000 + calidad * 300, temporada + 1],
    );
  }
}

export interface DatosClub {
  nombre: string;
  corto: string;
  ciudad: string;
  colores: [string, string];
  manager: string | null;
  nivel: number;
  grupo: number | null;
  temporadaId: number;
  temporadaNumero: number;
  inicio: Date;
  divisionNivel: NivelDivision;
}

/** Inserta un club completo: plantilla, instalaciones y fila de clasificación (si tiene grupo). */
export async function insertarClub(tx: Transaction, rng: Rng, c: DatosClub): Promise<string> {
  const presupuesto = division(c.divisionNivel).presupuesto;
  const id = (
    await tx.query<{ id: string }>(
      `insert into clubes (nombre, nombre_corto, ciudad, manager_id, perfil_bot, orden_en_grupo_empresarial, grupo_id,
         dinero, masa_social, popularidad, color_principal, color_secundario)
       values ($1, $2, $3, $4, $5::perfil_bot, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [
        c.nombre, c.corto, c.ciudad, c.manager, c.manager ? null : elegir(rng, ["equilibrado", "defensivo", "cantera", "gastador"]),
        c.manager ? 1 : null, c.grupo, Math.round(presupuesto * CLUB_NUEVO.dineroInicial),
        Math.round(CLUB_NUEVO.masaSocial * (1 + (5 - c.divisionNivel) * 0.8)), CLUB_NUEVO.popularidad, c.colores[0], c.colores[1],
      ],
    )
  ).rows[0].id;
  await insertarJugadores(tx, id, generarPlantilla(rng, c.nivel, c.inicio, c.temporadaNumero, c.divisionNivel));
  await insertarInstalaciones(tx, id);
  if (c.grupo != null) {
    await tx.query("insert into clasificacion (temporada_id, grupo_id, club_id) values ($1, $2, $3)", [c.temporadaId, c.grupo, id]);
  }
  return id;
}

/** Club bot con nombre y colores al azar (sin repetir nombres ya usados). */
export async function insertarClubBot(
  tx: Transaction,
  rng: Rng,
  c: Omit<DatosClub, "nombre" | "corto" | "ciudad" | "colores" | "manager">,
  usados: Set<string>,
): Promise<string> {
  const [b] = nombresClubes(rng, 1, usados);
  const corto = b.ciudad.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").slice(0, 3).toUpperCase();
  return insertarClub(tx, rng, { ...c, nombre: b.nombre, corto, ciudad: b.ciudad, colores: coloresBot(rng), manager: null });
}

export async function nombresUsados(tx: Transaction): Promise<Set<string>> {
  return new Set((await tx.query<{ n: string }>("select lower(nombre) as n from clubes")).rows.map((r) => r.n));
}

export class ErrorCreacion extends Error {}

/**
 * Crea la partida local: mánager, temporada, grupo de Quinta con 19 bots, el club del jugador
 * y los agentes libres del mercado.
 */
export async function crearPartidaLocal(datos: DatosClubNuevo, semilla = semillaAleatoria()): Promise<string> {
  const errores = validarClub(datos);
  if (Object.keys(errores).length > 0) throw new ErrorCreacion("Datos del club no válidos.");

  const bd = await bdLocal();
  const rng = crearRng(semilla);
  const quinta = division(5);

  const clubId = await bd.transaction(async (tx) => {
    const existentes = await tx.query<{ n: number }>("select count(*)::int as n from managers");
    if (existentes.rows[0].n > 0) throw new ErrorCreacion("Ya existe una partida en este ordenador.");

    const inicio = proximoLunes(new Date());
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + LIGA.semanasTemporada * 7 - 1);
    const temporada = (
      await tx.query<{ id: number }>(
        "insert into temporadas (numero, inicio, fin, actual) values (1, $1, $2, true) returning id",
        [isoFecha(inicio), isoFecha(fin)],
      )
    ).rows[0].id;
    const grupo = (await tx.query<{ id: number }>("insert into grupos (division, numero, abierto) values (5, 1, true) returning id")).rows[0].id;

    const usuario = (await tx.query<{ id: string }>("insert into auth.users default values returning id")).rows[0].id;
    await tx.query(
      "insert into managers (id, nombre, socio_fundador, tutorial_completado) values ($1, $2, true, false)",
      [usuario, datos.nombreManager.trim()],
    );

    const comun = { grupo, temporadaId: temporada, temporadaNumero: 1, inicio, divisionNivel: 5 as NivelDivision };
    const clubId = await insertarClub(tx, rng, {
      ...comun,
      nombre: datos.nombreClub.trim(),
      corto: datos.abreviatura.trim().toUpperCase(),
      ciudad: datos.ciudad.trim(),
      colores: [datos.colorPrincipal, datos.colorSecundario],
      manager: usuario,
      nivel: quinta.mediaTipica,
    });
    await insertarPersonalBasico(tx, rng, clubId, 1);

    // 19 bots, algo por debajo en Quinta para que el recién llegado no se hunda
    const nivelBot = quinta.mediaTipica * BOTS.nivelEnQuinta;
    const usados = new Set([datos.nombreClub.trim().toLowerCase()]);
    for (let i = 0; i < LIGA.equiposPorGrupo - 1; i++) {
      await insertarClubBot(tx, rng, { ...comun, nivel: nivelBot * uniforme(rng, 1 - BOTS.variacionNivel, 1 + BOTS.variacionNivel) }, usados);
    }
    await generarAgentesLibres(tx, rng, quinta.mediaTipica, MERCADO_LOCAL.agentesLibres, inicio, 1, 5);
    return clubId;
  });
  await asegurarCalendario();
  return clubId;
}
