import type { Transaction } from "@electric-sql/pglite";
import { crearRng, gauss, generarJugador, mediaJugador, semillaAleatoria, uniforme, type Posicion, type Rng } from "@/motor";
import { BOTS, CLUB_NUEVO, LIGA, MERCADO, division, valorOrientativo } from "@/dominio/reglas";
import { coloresBot, elegir, nombreJugador, nombresClubes } from "@/dominio/nombres";
import { bdLocal } from "./bd";

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
function proximoLunes(desde: Date): Date {
  const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
  const dias = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

const isoFecha = (d: Date) => d.toISOString().slice(0, 10);

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

function factorEdadValor(edad: number): number {
  if (edad <= 21) return 1.6;
  if (edad <= 24) return 1.25;
  if (edad >= 31) return 0.5;
  if (edad >= 29) return 0.8;
  return 1;
}

interface JugadorNuevo {
  nombre: string;
  apellido: string;
  nacimiento: string;
  posicion: Posicion;
  atributos: Record<string, number>;
  media: number;
  potencial: number;
  personalidad: string;
  contratoHasta: number;
  salario: number;
  valor: number;
  dorsal: number;
}

/** Plantilla de 22 jugadores con la media objetivo de su división. */
export function generarPlantilla(rng: Rng, nivel: number, inicioTemporada: Date, temporada: number): JugadorNuevo[] {
  const quinta = division(5);
  const posiciones: Posicion[] = [];
  for (const [pos, n] of Object.entries(CLUB_NUEVO.plantilla) as [Posicion, number][]) {
    for (let i = 0; i < n; i++) posiciones.push(pos);
  }
  const dorsalesPortero = [1, 13, 25];
  let siguienteDorsal = 2;
  let porteros = 0;

  return posiciones.map((posicion) => {
    const edad = Math.round(Math.min(35, Math.max(17, gauss(rng, 25, 4))));
    const nacimiento = new Date(inicioTemporada);
    nacimiento.setUTCFullYear(nacimiento.getUTCFullYear() - edad);
    nacimiento.setUTCDate(nacimiento.getUTCDate() - Math.floor(rng() * 365));
    const nivelJugador = Math.max(1, gauss(rng, nivel, 0.35));
    const j = generarJugador(rng, "", "", posicion, nivelJugador);
    const atributos = j.atributos as Record<string, number>;
    const media = mediaJugador(atributos);
    const extra = edad <= 22 ? uniforme(rng, 5, 30) : edad <= 26 ? uniforme(rng, 0, 12) : uniforme(rng, 0, 4);
    const potencial = Math.round(Math.min(100, media * 10 + extra));
    const salarioMedio = quinta.presupuesto * MERCADO.salarioMedio;
    const salario = Math.round((salarioMedio * (media / quinta.mediaTipica) ** 2) / 500) * 500;
    const valor = Math.round((valorOrientativo(media) * factorEdadValor(edad)) / 1000) * 1000;
    let dorsal: number;
    if (posicion === "POR") dorsal = dorsalesPortero[porteros++];
    else {
      if (siguienteDorsal === 13) siguienteDorsal++;
      dorsal = siguienteDorsal++;
    }
    return {
      ...nombreJugador(rng),
      nacimiento: isoFecha(nacimiento),
      posicion,
      atributos,
      media,
      potencial,
      personalidad: personalidad(rng),
      contratoHasta: temporada + 1 + Math.floor(rng() * 3),
      salario,
      valor,
      dorsal,
    };
  });
}

async function insertarPlantilla(tx: Transaction, clubId: string, jugadores: JugadorNuevo[]) {
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

export class ErrorCreacion extends Error {}

/**
 * Crea la partida local: mánager, temporada, grupo de Quinta con 19 bots y el club del jugador.
 * El club del jugador releva a un bot del grupo (al inicio de temporada todos tienen 0 puntos).
 */
export async function crearPartidaLocal(datos: DatosClubNuevo, semilla = semillaAleatoria()): Promise<string> {
  const errores = validarClub(datos);
  if (Object.keys(errores).length > 0) throw new ErrorCreacion("Datos del club no válidos.");

  const bd = await bdLocal();
  const rng = crearRng(semilla);
  const quinta = division(5);

  return bd.transaction(async (tx) => {
    const existentes = await tx.query<{ n: number }>("select count(*)::int as n from managers");
    if (existentes.rows[0].n > 0) throw new ErrorCreacion("Ya existe una partida en este ordenador.");

    // Temporada 1
    const inicio = proximoLunes(new Date());
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + LIGA.semanasTemporada * 7 - 1);
    const temporada = (
      await tx.query<{ id: number }>(
        "insert into temporadas (numero, inicio, fin, actual) values (1, $1, $2, true) returning id",
        [isoFecha(inicio), isoFecha(fin)],
      )
    ).rows[0].id;

    // Grupo 1 de Quinta
    const grupo = (
      await tx.query<{ id: number }>("insert into grupos (division, numero, abierto) values (5, 1, true) returning id")
    ).rows[0].id;

    // Mánager local
    const usuario = (await tx.query<{ id: string }>("insert into auth.users default values returning id")).rows[0].id;
    await tx.query(
      "insert into managers (id, nombre, socio_fundador, tutorial_completado) values ($1, $2, true, false)",
      [usuario, datos.nombreManager.trim()],
    );

    const dineroInicial = Math.round(quinta.presupuesto * CLUB_NUEVO.dineroInicial);
    const crearClub = async (c: {
      nombre: string; corto: string; ciudad: string; colores: [string, string]; manager: string | null; nivel: number;
    }) => {
      const id = (
        await tx.query<{ id: string }>(
          `insert into clubes (nombre, nombre_corto, ciudad, manager_id, perfil_bot, orden_en_grupo_empresarial, grupo_id,
             dinero, masa_social, popularidad, color_principal, color_secundario)
           values ($1, $2, $3, $4, $5::perfil_bot, $6, $7, $8, $9, $10, $11, $12) returning id`,
          [
            c.nombre, c.corto, c.ciudad, c.manager, c.manager ? null : elegir(rng, ["equilibrado", "defensivo", "cantera", "gastador"]),
            c.manager ? 1 : null, grupo, dineroInicial, CLUB_NUEVO.masaSocial, CLUB_NUEVO.popularidad, c.colores[0], c.colores[1],
          ],
        )
      ).rows[0].id;
      await insertarPlantilla(tx, id, generarPlantilla(rng, c.nivel, inicio, 1));
      await insertarInstalaciones(tx, id);
      await tx.query(
        "insert into clasificacion (temporada_id, grupo_id, club_id) values ($1, $2, $3)",
        [temporada, grupo, id],
      );
      return id;
    };

    // Club del jugador, con la media típica de Quinta
    const clubId = await crearClub({
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
    for (const b of nombresClubes(rng, LIGA.equiposPorGrupo - 1, usados)) {
      const corto = b.ciudad.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").slice(0, 3).toUpperCase();
      await crearClub({
        nombre: b.nombre,
        corto,
        ciudad: b.ciudad,
        colores: coloresBot(rng),
        manager: null,
        nivel: nivelBot * uniforme(rng, 1 - BOTS.variacionNivel, 1 + BOTS.variacionNivel),
      });
    }
    return clubId;
  });
}
