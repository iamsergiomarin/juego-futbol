/**
 * Patrocinio del club: ofertas de pretemporada, contratos, pagos semanales y liquidación de temporada.
 */
import type { Transaction } from "@electric-sql/pglite";
import { crearRng } from "@/motor";
import { generarOfertas, importeSinContrato, liquidarContrato, resolverContraoferta } from "@/dominio/patrocinio";
import {
  ESPACIOS_PATROCINIO,
  PERFILES_PATROCINIO,
  PATROCINIO,
  division,
  type EspacioPatrocinio,
  type NivelDivision,
  type PerfilPatrocinio,
} from "@/dominio/reglas";
import { bdLocal } from "./bd";
import { publicarEvento } from "./grada";
import { movimiento } from "./liga";

export class ErrorPatrocinio extends Error {}

export interface OfertaVista {
  id: string;
  espacio: EspacioPatrocinio;
  marca: string;
  perfil: PerfilPatrocinio;
  fijo: number;
  prima: number;
  objetivoPosicion: number;
  duracion: number;
  renovacion: boolean;
  contraofertada: boolean;
}

export interface ContratoVisto {
  id: string;
  espacio: EspacioPatrocinio;
  marca: string;
  perfil: PerfilPatrocinio;
  fijo: number;
  prima: number;
  objetivoPosicion: number | null;
  desde: number;
  hasta: number;
  satisfaccion: number;
}

const ESPACIOS = Object.keys(ESPACIOS_PATROCINIO) as EspacioPatrocinio[];

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

async function temporadaActual(tx: Transaction): Promise<{ id: number; numero: number }> {
  return (await tx.query<{ id: number; numero: number }>("select id, numero from temporadas where actual")).rows[0];
}

/**
 * Pretemporada: cada espacio sin contrato vigente y sin ofertas esta temporada recibe sus ofertas.
 * Es idempotente: se puede llamar al cargar cualquier pantalla.
 */
export async function asegurarOfertas(tx: Transaction, clubId: string): Promise<void> {
  const t = await temporadaActual(tx);
  if (!t) return;
  const club = (
    await tx.query<{ division: NivelDivision; popularidad: number; humano: boolean }>(
      "select g.division, c.popularidad::float8 as popularidad, c.manager_id is not null as humano from clubes c join grupos g on g.id = c.grupo_id where c.id = $1",
      [clubId],
    )
  ).rows[0];
  if (!club?.humano) return;
  const presupuesto = division(club.division).presupuesto;

  for (const espacio of ESPACIOS) {
    const vigente = (await tx.query("select 1 from patrocinios where club_id = $1 and espacio = $2 and desde_temporada <= $3 and hasta_temporada >= $3", [clubId, espacio, t.numero])).rows.length > 0;
    if (vigente) continue;
    const yaHubo = (await tx.query("select 1 from ofertas_patrocinio where club_id = $1 and temporada_id = $2 and espacio = $3", [clubId, t.id, espacio])).rows.length > 0;
    if (yaHubo) continue;

    // Marca anterior de este espacio: satisfecha, vuelve al alza; descontenta, no vuelve.
    const previo = (
      await tx.query<{ marca: string; perfil: PerfilPatrocinio; satisfaccion: number }>(
        "select marca, perfil, satisfaccion from patrocinios where club_id = $1 and espacio = $2 and hasta_temporada < $3 order by hasta_temporada desc limit 1",
        [clubId, espacio, t.numero],
      )
    ).rows[0];
    const otroEspacio = (await tx.query<{ marca: string }>("select marca from patrocinios where club_id = $1 and espacio <> $2 and hasta_temporada >= $3", [clubId, espacio, t.numero])).rows.map((r) => r.marca);
    const ofrecidas = (await tx.query<{ marca: string }>("select marca from ofertas_patrocinio where club_id = $1 and temporada_id = $2 and espacio <> $3", [clubId, t.id, espacio])).rows.map((r) => r.marca);
    const excluidas = [...otroEspacio, ...ofrecidas];
    let renovacion: { marca: string; perfil: PerfilPatrocinio } | undefined;
    if (previo) {
      if (previo.satisfaccion >= PATROCINIO.satisfaccionRenueva) renovacion = { marca: previo.marca, perfil: previo.perfil };
      else if (previo.satisfaccion <= PATROCINIO.satisfaccionSeMarcha + 15) excluidas.push(previo.marca);
    }
    const rng = crearRng(hash(`${clubId}|${t.id}|${espacio}`));
    for (const o of generarOfertas({ espacio, presupuesto, popularidad: club.popularidad, rng, excluidas, renovacion })) {
      await tx.query(
        `insert into ofertas_patrocinio (club_id, temporada_id, espacio, marca, perfil, fijo, prima, objetivo_posicion, duracion, margen, renovacion)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [clubId, t.id, o.espacio, o.marca, o.perfil, o.fijo, o.prima, o.objetivoPosicion, o.duracion, o.margen, o.renovacion],
      );
    }
  }
}

export async function ofertasPendientes(clubId: string): Promise<OfertaVista[]> {
  const bd = await bdLocal();
  await bd.transaction((tx) => asegurarOfertas(tx, clubId));
  return (
    await bd.query<OfertaVista>(
      `select o.id, o.espacio, o.marca, o.perfil, o.fijo::float8 as fijo, o.prima::float8 as prima, o.objetivo_posicion as "objetivoPosicion",
              o.duracion, o.renovacion, o.contraofertada
         from ofertas_patrocinio o join temporadas t on t.id = o.temporada_id
        where o.club_id = $1 and t.actual and o.estado = 'pendiente' order by o.espacio, o.fijo desc`,
      [clubId],
    )
  ).rows;
}

export async function contratosActivos(clubId: string): Promise<ContratoVisto[]> {
  const bd = await bdLocal();
  return (
    await bd.query<ContratoVisto>(
      `select p.id, p.espacio, p.marca, p.perfil, p.fijo_por_temporada::float8 as fijo, p.prima::float8 as prima,
              p.objetivo_posicion as "objetivoPosicion", p.desde_temporada as desde, p.hasta_temporada as hasta, p.satisfaccion
         from patrocinios p where p.club_id = $1 and p.hasta_temporada >= (select numero from temporadas where actual) order by p.espacio`,
      [clubId],
    )
  ).rows;
}

async function ofertaDe(tx: Transaction, clubId: string, id: string) {
  const o = (
    await tx.query<OfertaVista & { margen: number; temporadaId: number }>(
      `select id, espacio, marca, perfil, fijo::float8 as fijo, prima::float8 as prima, objetivo_posicion as "objetivoPosicion", duracion,
              renovacion, contraofertada, margen::float8 as margen, temporada_id as "temporadaId"
         from ofertas_patrocinio where id = $1 and club_id = $2 and estado = 'pendiente'`,
      [id, clubId],
    )
  ).rows[0];
  if (!o) throw new ErrorPatrocinio("Esa oferta ya no está disponible.");
  return o;
}

export async function aceptarOferta(clubId: string, ofertaId: string): Promise<void> {
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    const o = await ofertaDe(tx, clubId, ofertaId);
    const t = await temporadaActual(tx);
    const vigente = (await tx.query("select 1 from patrocinios where club_id = $1 and espacio = $2 and hasta_temporada >= $3", [clubId, o.espacio, t.numero])).rows.length > 0;
    if (vigente) throw new ErrorPatrocinio("Ese espacio ya tiene patrocinador.");
    await tx.query(
      `insert into patrocinios (club_id, marca, perfil, espacio, fijo_por_temporada, prima, objetivo_posicion, desde_temporada, hasta_temporada, satisfaccion)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [clubId, o.marca, o.perfil, o.espacio, o.fijo, o.prima, o.objetivoPosicion, t.numero, t.numero + o.duracion - 1, PATROCINIO.satisfaccionInicial],
    );
    await tx.query("update ofertas_patrocinio set estado = 'aceptada' where id = $1", [o.id]);
    // La marca no puede patrocinar dos espacios: sus otras ofertas se retiran, igual que las rivales de este espacio.
    await tx.query("update ofertas_patrocinio set estado = 'retirada' where club_id = $1 and temporada_id = $2 and estado = 'pendiente' and (espacio = $3 or marca = $4)", [clubId, o.temporadaId, o.espacio, o.marca]);
    await publicarEvento(tx, clubId, { tipo: "patrocinio", marca: o.marca, espacio: ESPACIOS_PATROCINIO[o.espacio].nombre, perfil: o.perfil, temporadas: o.duracion, importe: o.fijo });
  });
}

export async function rechazarOferta(clubId: string, ofertaId: string): Promise<void> {
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    const o = await ofertaDe(tx, clubId, ofertaId);
    await tx.query("update ofertas_patrocinio set estado = 'rechazada' where id = $1", [o.id]);
  });
}

/** Contraoferta única: si cabe en el margen de la marca, mejora el fijo; si no, la marca retira su oferta. */
export async function contraofertar(clubId: string, ofertaId: string, subida: number): Promise<{ aceptada: boolean; marca: string }> {
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const o = await ofertaDe(tx, clubId, ofertaId);
    if (o.contraofertada) throw new ErrorPatrocinio("Ya contraofertaste a esta marca: solo se puede una vez.");
    const r = resolverContraoferta(o.fijo, o.margen, subida);
    if (r.aceptada) {
      await tx.query("update ofertas_patrocinio set fijo = $2, prima = $3, contraofertada = true where id = $1", [o.id, r.fijo, Math.round((r.fijo * PATROCINIO.primaObjetivo) / 1000) * 1000]);
    } else {
      await tx.query("update ofertas_patrocinio set estado = 'retirada', contraofertada = true where id = $1", [o.id]);
    }
    return { aceptada: r.aceptada, marca: o.marca };
  });
}

/** Pago semanal (cierre de semana): contratos de los clubes con mánager; el resto, la referencia de la división. */
export async function pagarPatrocinios(
  tx: Transaction,
  temporada: { id: number; numero: number },
  jornada: number,
  clubes: { id: string; division: NivelDivision; humano: boolean }[],
  semanas: number,
  baseBots: number,
): Promise<void> {
  for (const c of clubes) {
    const presupuesto = division(c.division).presupuesto;
    if (!c.humano) {
      await movimiento(tx, c.id, temporada.id, jornada, "Patrocinio", (presupuesto * baseBots) / semanas);
      continue;
    }
    const contratos = (
      await tx.query<{ espacio: EspacioPatrocinio; marca: string; fijo: number }>(
        "select espacio, marca, fijo_por_temporada::float8 as fijo from patrocinios where club_id = $1 and desde_temporada <= $2 and hasta_temporada >= $2",
        [c.id, temporada.numero],
      )
    ).rows;
    for (const e of ESPACIOS) {
      const k = contratos.find((x) => x.espacio === e);
      if (k) await movimiento(tx, c.id, temporada.id, jornada, `Patrocinio: ${k.marca} (${ESPACIOS_PATROCINIO[e].nombre.toLowerCase()})`, k.fijo / semanas);
      else await movimiento(tx, c.id, temporada.id, jornada, `Patrocinio sin contrato (${ESPACIOS_PATROCINIO[e].nombre.toLowerCase()})`, importeSinContrato(presupuesto, e) / semanas);
    }
  }
}

/** Fin de temporada: primas por objetivo, satisfacción, popularidad y salida de los descontentos. */
export async function liquidarPatrocinios(tx: Transaction, clubId: string, temporada: { id: number; numero: number }, posicion: number): Promise<void> {
  const contratos = (
    await tx.query<{ id: string; marca: string; espacio: EspacioPatrocinio; perfil: PerfilPatrocinio; prima: number; objetivoPosicion: number | null; satisfaccion: number }>(
      `select id, marca, espacio, perfil, prima::float8 as prima, objetivo_posicion as "objetivoPosicion", satisfaccion
         from patrocinios where club_id = $1 and desde_temporada <= $2 and hasta_temporada >= $2`,
      [clubId, temporada.numero],
    )
  ).rows;
  let popularidad = 0;
  for (const c of contratos) {
    const l = liquidarContrato(c, posicion);
    if (l.cobraPrima) await movimiento(tx, clubId, temporada.id, null, `Prima de ${c.marca} por el objetivo`, c.prima);
    popularidad += PERFILES_PATROCINIO[c.perfil].popularidad;
    await tx.query("update patrocinios set satisfaccion = $2, hasta_temporada = case when $3 then $4 else hasta_temporada end where id = $1", [c.id, l.satisfaccion, l.seMarcha, temporada.numero]);
  }
  if (popularidad !== 0) await tx.query("update clubes set popularidad = greatest(0, least(100, popularidad + $2)) where id = $1", [clubId, popularidad]);
}
