import type { Posicion } from "@/motor";
import { margenOjeador, rangoAproximado, salarioPedido } from "@/dominio/mercado";
import type { NivelDivision } from "@/dominio/reglas";
import { bdLocal } from "./bd";

/**
 * Lo que el cuerpo técnico estima del potencial (media máxima): el rango se estrecha
 * con un mejor segundo entrenador. Determinista para que no cambie al recargar.
 */
export function potencialEstimado(potencial: number, calidadEntrenador: number, semilla: string): string {
  const margen = Math.max(4, Math.round(20 - calidadEntrenador * 0.15));
  const [a, b] = rangoAproximado(potencial, margen, `${semilla}-pot`);
  const f = (x: number) => (x / 10).toFixed(1).replace(".", ",");
  return `${f(a)} – ${f(b)}`;
}

export interface DetalleJugador {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  edad: number;
  dorsal: number | null;
  personalidad: string;
  media: number;
  /** Exacta si es tuyo; si no, lo que ve tu ojeador. */
  mediaRango: [number, number] | null;
  atributos: { clave: string; valor: number | null; rango: [number, number] | null }[];
  potencialTexto: string;
  propio: boolean;
  club: { id: string; nombre: string } | null;
  salario: number;
  valor: number;
  contratoHasta: number | null;
  precioVenta: number | null;
  cansancio: number;
  forma: number;
  moral: number;
  jornadasLesion: number;
  tipoLesion: string | null;
  foco: string | null;
  cambiosSemana: Record<string, number>;
  salarioPedido: number;
  partidos: number;
  goles: number;
  temporadaActual: number;
  retirado: boolean;
}

export async function detalleJugador(id: string, clubVista: string): Promise<DetalleJugador | null> {
  const bd = await bdLocal();
  const j = (
    await bd.query<{
      id: string; nombre: string; apellido: string; posicion: Posicion; edad: number; dorsal: number | null; personalidad: string;
      media: number; atributos: Record<string, number>; potencial: number; club_id: string | null; club_nombre: string | null;
      salario: number; valor: number; contrato: number | null; precio: number | null; cansancio: number; forma: number; moral: number;
      lesion: number; tipo_lesion: string | null; foco: string | null; cambios: Record<string, number>; retirado: boolean;
    }>(
      `select j.id, j.nombre, j.apellido, j.posicion, j.dorsal, j.personalidad, j.media::float8 as media, j.atributos, j.potencial,
              date_part('year', age((select inicio from temporadas where actual), j.fecha_nacimiento))::int as edad,
              j.club_id, c.nombre as club_nombre, j.salario::float8 as salario, j.valor_mercado::float8 as valor,
              j.contrato_hasta as contrato, j.precio_venta::float8 as precio, j.cansancio::float8 as cansancio, j.forma, j.moral,
              j.jornadas_lesion as lesion, j.tipo_lesion, j.foco, j.cambios_semana as cambios, j.retirado
         from jugadores j left join clubes c on c.id = j.club_id where j.id = $1`,
      [id],
    )
  ).rows[0];
  if (!j) return null;
  const propio = j.club_id === clubVista;
  const contexto = (
    await bd.query<{ ojeador: number; entrenador: number; division: number; temporada: number }>(
      `select coalesce((select max(calidad) from personal where club_id = $1 and puesto = 'ojeador'), 15)::int as ojeador,
              coalesce((select max(calidad) from personal where club_id = $1 and puesto = 'segundo_entrenador'), 25)::int as entrenador,
              coalesce((select g.division from clubes c join grupos g on g.id = c.grupo_id where c.id = $1), 5)::int as division,
              (select numero from temporadas where actual) as temporada`,
      [clubVista],
    )
  ).rows[0];
  const margen = margenOjeador(contexto.ojeador);
  const atributos = Object.entries(j.atributos).map(([clave, valor]) =>
    propio ? { clave, valor, rango: null } : { clave, valor: null, rango: rangoAproximado(valor, margen, `${j.id}-${clave}`) },
  );
  const mediaRango = propio ? null : (rangoAproximado(Math.round(j.media * 10), margen, j.id).map((x) => x / 10) as [number, number]);
  const stats = (
    await bd.query<{ partidos: number; goles: number }>(
      `select (select count(*) from planteamientos pl join partidos p on p.id = pl.partido_id
                where $1::uuid = any(pl.titulares) and p.competicion = 'liga' and p.temporada_id = (select id from temporadas where actual))::int as partidos,
              (select count(*) from partidos p, jsonb_array_elements(p.eventos) e
                where p.competicion = 'liga' and p.temporada_id = (select id from temporadas where actual)
                  and e->>'tipo' = 'gol' and e->>'jugadorId' = $1::text)::int as goles`,
      [id],
    )
  ).rows[0];
  return {
    id: j.id,
    nombre: j.nombre,
    apellido: j.apellido,
    posicion: j.posicion,
    edad: j.edad,
    dorsal: j.dorsal,
    personalidad: j.personalidad,
    media: j.media,
    mediaRango,
    atributos,
    potencialTexto: potencialEstimado(j.potencial, propio ? contexto.entrenador : contexto.ojeador, j.id),
    propio,
    club: j.club_id ? { id: j.club_id, nombre: j.club_nombre! } : null,
    salario: j.salario,
    valor: j.valor,
    contratoHasta: j.contrato,
    precioVenta: j.precio,
    cansancio: j.cansancio,
    forma: j.forma,
    moral: j.moral,
    jornadasLesion: j.lesion,
    tipoLesion: j.tipo_lesion,
    foco: j.foco,
    cambiosSemana: j.cambios ?? {},
    salarioPedido: salarioPedido(j, contexto.division as NivelDivision),
    partidos: stats.partidos,
    goles: stats.goles,
    temporadaActual: contexto.temporada,
    retirado: j.retirado,
  };
}
