import type { PGlite, Transaction } from "@electric-sql/pglite";
import { crearRng, semillaAleatoria, uniforme, type Posicion, type Rng } from "@/motor";
import { MERCADO_LOCAL, margenOjeador, rangoAproximado, salarioPedido, ventanaAbierta } from "@/dominio/mercado";
import { MERCADO, TOPE_DIRECCION_DEPORTIVA, division, type NivelDivision } from "@/dominio/reglas";
import { bdLocal } from "./bd";
import { movimiento } from "./liga";
import { generarAgentesLibres } from "./mundo";
import { publicarNoticia } from "./noticias";

type Consulta = PGlite | Transaction;

export class ErrorMercado extends Error {}

interface Contexto {
  temporadaId: number;
  numero: number;
  fase: string;
  jugadas: number;
  inicio: string;
}

async function contexto(bd: Consulta): Promise<Contexto> {
  const { rows } = await bd.query<Contexto>(
    `select t.id as "temporadaId", t.numero, t.fase, to_char(t.inicio, 'YYYY-MM-DD') as inicio,
            coalesce((select max(jornada) from partidos p where p.temporada_id = t.id and p.competicion = 'liga'
                        and not exists (select 1 from partidos q where q.temporada_id = t.id and q.competicion = 'liga'
                                          and q.jornada = p.jornada and q.estado <> 'finalizado')), 0)::int as jugadas
       from temporadas t where t.actual`,
  );
  return rows[0];
}

async function divisionDe(bd: Consulta, clubId: string): Promise<NivelDivision> {
  const r = (await bd.query<{ d: number }>("select coalesce(g.division, 5)::int as d from clubes c left join grupos g on g.id = c.grupo_id where c.id = $1", [clubId])).rows[0];
  return (r?.d ?? 5) as NivelDivision;
}

/** Agentes libres para partidas creadas antes de que existiera el mercado. */
export async function asegurarMercado(): Promise<void> {
  const bd = await bdLocal();
  await bd.transaction(async (tx) => {
    const libres = (await tx.query<{ n: number }>("select count(*)::int as n from jugadores where club_id is null and not retirado")).rows[0].n;
    if (libres > 0) return;
    const c = await contexto(tx);
    if (!c) return;
    const nivel = (
      await tx.query<{ m: number }>(
        "select coalesce(avg(j.media), 3.5)::float8 as m from jugadores j join clubes c on c.id = j.club_id where c.manager_id is not null",
      )
    ).rows[0].m;
    await generarAgentesLibres(tx, crearRng(semillaAleatoria()), nivel, MERCADO_LOCAL.agentesLibres, new Date(`${c.inicio}T12:00:00Z`), c.numero, 5);
  });
}

export interface EstadoMercado {
  ventana: boolean;
  caja: number;
  plantilla: number;
  topeMedia: number;
  topePrecio: number | null;
  margen: number;
  division: NivelDivision;
}

export async function estadoMercado(clubId: string, consulta?: Consulta): Promise<EstadoMercado> {
  const bd = consulta ?? (await bdLocal());
  const c = await contexto(bd);
  const nivel = await divisionDe(bd, clubId);
  const club = (
    await bd.query<{ caja: number; plantilla: number; direccion: number; ojeador: number }>(
      `select c.dinero::float8 as caja,
              (select count(*) from jugadores j where j.club_id = c.id and j.ficha = 'primer_equipo' and not j.retirado)::int as plantilla,
              coalesce((select a.nivel from areas a join edificios e on e.id = a.edificio_id
                         where e.club_id = c.id and a.tipo = 'direccion_deportiva'), 1)::int as direccion,
              coalesce((select max(calidad) from personal p where p.club_id = c.id and p.puesto = 'ojeador'), 15)::int as ojeador
         from clubes c where c.id = $1`,
      [clubId],
    )
  ).rows[0];
  return {
    ventana: ventanaAbierta(c.jugadas, c.fase),
    caja: club.caja,
    plantilla: club.plantilla,
    topeMedia: TOPE_DIRECCION_DEPORTIVA[club.direccion] ?? 5,
    topePrecio: division(nivel).topePrecio,
    margen: margenOjeador(club.ojeador),
    division: nivel,
  };
}

export interface OfertaMercado {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  edad: number;
  media: number;
  mediaRango: [number, number];
  valor: number;
  precio: number;
  salarioPedido: number;
  clubId: string | null;
  club: string | null;
  personalidad: string;
}

/** Jugadores disponibles: agentes libres y transferibles de otros clubes. */
export async function ofertasMercado(clubId: string, filtro: { tipo?: "libres" | "transferibles"; posicion?: Posicion }): Promise<OfertaMercado[]> {
  const bd = await bdLocal();
  const est = await estadoMercado(clubId);
  const { rows } = await bd.query<Omit<OfertaMercado, "mediaRango" | "salarioPedido"> & { salario: number }>(
    `select j.id, j.nombre, j.apellido, j.posicion, j.media::float8 as media, j.valor_mercado::float8 as valor,
            coalesce(j.precio_venta, 0)::float8 as precio, j.salario::float8 as salario, j.personalidad,
            date_part('year', age((select inicio from temporadas where actual), j.fecha_nacimiento))::int as edad,
            c.id as "clubId", c.nombre as club
       from jugadores j left join clubes c on c.id = j.club_id
      where not j.retirado and (j.club_id is null or (j.precio_venta is not null and j.club_id <> $1))
        and ($2::text is null or (case when $2 = 'libres' then j.club_id is null else j.club_id is not null end))
        and ($3::text is null or j.posicion = $3::posicion)
      order by j.media desc
      limit 120`,
    [clubId, filtro.tipo ?? null, filtro.posicion ?? null],
  );
  return rows.map((r) => {
    const [a, b] = rangoAproximado(Math.round(r.media * 10), est.margen, r.id);
    return { ...r, mediaRango: [a / 10, b / 10] as [number, number], salarioPedido: salarioPedido(r, est.division) };
  });
}

/** Ficha a un jugador: traspaso (en ventana) o agente libre (siempre). */
export async function ficharJugador(clubId: string, jugadorId: string, temporadas: number): Promise<string> {
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const c = await contexto(tx);
    const est = await estadoMercado(clubId, tx);
    const j = (
      await tx.query<{ id: string; nombre: string; apellido: string; media: number; valor: number; precio: number | null; salario: number; personalidad: string; club: string | null }>(
        `select id, nombre, apellido, media::float8 as media, valor_mercado::float8 as valor, precio_venta::float8 as precio,
                salario::float8 as salario, personalidad, club_id as club
           from jugadores where id = $1 and not retirado for update`,
        [jugadorId],
      )
    ).rows[0];
    if (!j) throw new ErrorMercado("El jugador ya no está disponible.");
    if (j.club === clubId) throw new ErrorMercado("Ya es de tu club.");
    const libre = j.club === null;
    if (!libre && j.precio == null) throw new ErrorMercado("No está en venta.");
    if (!libre && !est.ventana) throw new ErrorMercado("La ventana de traspasos está cerrada. Los agentes libres se pueden fichar siempre.");
    if (est.plantilla >= MERCADO_LOCAL.maximoPlantilla) throw new ErrorMercado(`La plantilla está completa (${MERCADO_LOCAL.maximoPlantilla} fichas).`);
    if (j.media > est.topeMedia) {
      throw new ErrorMercado(`Tu dirección deportiva solo puede fichar jugadores de media ${String(est.topeMedia).replace(".", ",")} o menos.`);
    }
    const precio = libre ? 0 : j.precio!;
    if (!libre && est.topePrecio != null && precio > j.valor * est.topePrecio) throw new ErrorMercado("El precio supera el tope de tu división.");
    const comision = Math.round(precio * MERCADO.comisionFederacion);
    const salario = salarioPedido(j, est.division);
    const prima = libre ? Math.round(salario / 4) : 0;
    if (est.caja < precio + comision + prima) throw new ErrorMercado("No hay dinero suficiente en caja.");

    const duracion = Math.max(1, Math.min(3, Math.round(temporadas)));
    const dorsal = (
      await tx.query<{ d: number }>(
        `select min(n)::int as d from generate_series(2, 99) n
          where n <> 13 and not exists (select 1 from jugadores where club_id = $1 and dorsal = n)`,
        [clubId],
      )
    ).rows[0].d;
    await tx.query(
      `update jugadores set club_id = $2, precio_venta = null, salario = $3, contrato_hasta = $4, dorsal = $5,
              ficha = 'primer_equipo', moral = least(95, moral + 10) where id = $1`,
      [jugadorId, clubId, salario, c.numero + duracion - (c.fase === "terminada" ? 0 : 1), dorsal],
    );
    const nombre = `${j.nombre} ${j.apellido}`;
    if (libre) {
      await movimiento(tx, clubId, c.temporadaId, null, "Primas de fichaje", -prima);
    } else {
      await movimiento(tx, clubId, c.temporadaId, null, "Fichajes", -precio);
      await movimiento(tx, clubId, c.temporadaId, null, "Comisión de la federación", -comision);
      await movimiento(tx, j.club!, c.temporadaId, null, "Traspasos", precio);
      await reponerBot(tx, j.club!, crearRng(semillaAleatoria()));
    }
    await publicarNoticia(tx, clubId, "fichaje", `Fichaje: ${nombre}`,
      libre
        ? `Llega como agente libre. Prima de fichaje: ${prima.toLocaleString("es-ES")} €. Salario: ${salario.toLocaleString("es-ES")} € por temporada.`
        : `Traspaso de ${precio.toLocaleString("es-ES")} € (más ${comision.toLocaleString("es-ES")} € de comisión). Salario: ${salario.toLocaleString("es-ES")} € por temporada.`,
      c.jugadas || null);
    return nombre;
  });
}

/** Pone a un jugador propio en el mercado con un precio. */
export async function ponerEnVenta(clubId: string, jugadorId: string, precio: number | null): Promise<void> {
  const bd = await bdLocal();
  const r = await bd.query("update jugadores set precio_venta = $3 where id = $1 and club_id = $2", [jugadorId, clubId, precio && precio > 0 ? Math.round(precio) : null]);
  if (r.affectedRows === 0) throw new ErrorMercado("Ese jugador no es de tu club.");
}

/** Renueva el contrato de un jugador propio con lo que pide. */
export async function renovarContrato(clubId: string, jugadorId: string, temporadas: number): Promise<number> {
  const bd = await bdLocal();
  return bd.transaction(async (tx) => {
    const c = await contexto(tx);
    const nivel = await divisionDe(tx, clubId);
    const j = (
      await tx.query<{ nombre: string; apellido: string; media: number; salario: number; personalidad: string; contrato: number | null }>(
        `select nombre, apellido, media::float8 as media, salario::float8 as salario, personalidad, contrato_hasta as contrato
           from jugadores where id = $1 and club_id = $2`,
        [jugadorId, clubId],
      )
    ).rows[0];
    if (!j) throw new ErrorMercado("Ese jugador no es de tu club.");
    const salario = salarioPedido(j, nivel);
    const hasta = Math.max(j.contrato ?? c.numero, c.numero) + Math.max(1, Math.min(3, Math.round(temporadas)));
    await tx.query("update jugadores set salario = $3, contrato_hasta = $4, moral = least(95, moral + 5) where id = $1 and club_id = $2", [jugadorId, clubId, salario, hasta]);
    await publicarNoticia(tx, clubId, "contrato", `Renovación de ${j.nombre} ${j.apellido}`,
      `Firma hasta la temporada ${hasta} con un salario de ${salario.toLocaleString("es-ES")} € por temporada.`, null);
    return hasta;
  });
}

/** Un bot con la plantilla corta ficha agentes libres de los puestos que le faltan. */
async function reponerBot(tx: Transaction, clubId: string, rng: Rng) {
  const bot = (await tx.query<{ bot: boolean }>("select manager_id is null as bot from clubes where id = $1", [clubId])).rows[0];
  if (!bot?.bot) return;
  const plantilla = (await tx.query<{ posicion: Posicion }>("select posicion from jugadores where club_id = $1 and not retirado", [clubId])).rows;
  const objetivo: Record<Posicion, number> = { POR: 3, DEF: 7, MED: 7, DEL: 5 };
  let total = plantilla.length;
  for (const pos of ["POR", "DEF", "MED", "DEL"] as Posicion[]) {
    let faltan = objetivo[pos] - plantilla.filter((p) => p.posicion === pos).length;
    while (faltan > 0 && total < MERCADO_LOCAL.minimoBot + 2) {
      const libre = (
        await tx.query<{ id: string }>(
          "select id from jugadores where club_id is null and not retirado and posicion = $1::posicion order by media desc limit 3",
          [pos],
        )
      ).rows;
      if (libre.length === 0) break;
      const elegido = libre[Math.floor(rng() * libre.length)];
      await tx.query("update jugadores set club_id = $2, contrato_hasta = (select numero from temporadas where actual) + 1 where id = $1", [elegido.id, clubId]);
      faltan--;
      total++;
    }
  }
}

/**
 * Lo que pasa en el mercado en cada jornada: los bots ponen jugadores a la venta y,
 * con la ventana abierta, compran a precio razonable los que el mánager tiene en venta.
 */
export async function actividadMercadoJornada(tx: Transaction, temporadaId: number, jornada: number, rng: Rng): Promise<void> {
  const c = await contexto(tx);
  // Los bots rotan su lista de transferibles.
  const bots = (
    await tx.query<{ id: string }>("select c.id from clubes c join grupos g on g.id = c.grupo_id where g.abierto and c.manager_id is null")
  ).rows;
  for (const b of bots) {
    const enVenta = (await tx.query<{ n: number }>("select count(*)::int as n from jugadores where club_id = $1 and precio_venta is not null", [b.id])).rows[0].n;
    if (enVenta < 2 && rng() < 0.25) {
      const candidato = (
        await tx.query<{ id: string; valor: number }>(
          `select id, valor_mercado::float8 as valor from jugadores where club_id = $1 and precio_venta is null and not retirado
            order by random() limit 1`,
          [b.id],
        )
      ).rows[0];
      if (candidato) {
        const [min, max] = MERCADO_LOCAL.precioBot;
        await tx.query("update jugadores set precio_venta = $2 where id = $1", [candidato.id, Math.round((candidato.valor * uniforme(rng, min, max)) / 1000) * 1000]);
      }
    } else if (enVenta > 0 && rng() < 0.1) {
      await tx.query(
        "update jugadores set precio_venta = null where id = (select id from jugadores where club_id = $1 and precio_venta is not null order by random() limit 1)",
        [b.id],
      );
    }
  }

  // Ofertas de los bots por los jugadores en venta del mánager.
  if (!ventanaAbierta(c.jugadas, c.fase)) return;
  const enVenta = (
    await tx.query<{ id: string; nombre: string; apellido: string; club: string; precio: number; valor: number }>(
      `select j.id, j.nombre, j.apellido, j.club_id as club, j.precio_venta::float8 as precio, j.valor_mercado::float8 as valor
         from jugadores j join clubes c on c.id = j.club_id where c.manager_id is not null and j.precio_venta is not null`,
    )
  ).rows;
  for (const j of enVenta) {
    const ratio = j.precio / Math.max(1, j.valor);
    const probabilidad = Math.max(0, Math.min(0.35, 0.35 * ((1.3 - ratio) / 0.3)));
    if (rng() >= probabilidad || bots.length === 0) continue;
    const comprador = bots[Math.floor(rng() * bots.length)].id;
    const nombreComprador = (await tx.query<{ n: string }>("select nombre as n from clubes where id = $1", [comprador])).rows[0].n;
    await tx.query("update jugadores set club_id = $2, precio_venta = null, dorsal = null, foco = null where id = $1", [j.id, comprador]);
    await movimiento(tx, j.club, temporadaId, jornada, "Traspasos", j.precio);
    await movimiento(tx, comprador, temporadaId, jornada, "Fichajes", -j.precio);
    await tx.query(
      `update clubes set planteamiento = jsonb_set(jsonb_set(planteamiento,
          '{once}', (select coalesce(jsonb_agg(case when x = to_jsonb($2::text) then 'null'::jsonb else x end), '[]') from jsonb_array_elements(planteamiento->'once') x)),
          '{banquillo}', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(planteamiento->'banquillo') x where x <> to_jsonb($2::text)))
        where id = $1 and planteamiento is not null`,
      [j.club, j.id],
    );
    await publicarNoticia(tx, j.club, "venta", `Vendido: ${j.nombre} ${j.apellido}`,
      `${nombreComprador} paga ${j.precio.toLocaleString("es-ES")} € por su traspaso.`, jornada);
  }
}
