import type { PGlite, Transaction } from "@electric-sql/pglite";

type Consulta = PGlite | Transaction;

export type TipoNoticia = "lesion" | "entrenamiento" | "fichaje" | "venta" | "contrato" | "temporada" | "partido" | "alineacion";

/** Una novedad que el cuerpo técnico le cuenta al mánager. Solo se guarda en clubes con mánager. */
export async function publicarNoticia(
  bd: Consulta,
  clubId: string,
  tipo: TipoNoticia,
  titulo: string,
  texto: string,
  jornada: number | null = null,
): Promise<void> {
  await bd.query(
    `insert into noticias (club_id, temporada_id, jornada, tipo, titulo, texto)
     select c.id, (select id from temporadas where actual), $2, $3, $4, $5
       from clubes c where c.id = $1 and c.manager_id is not null`,
    [clubId, jornada, tipo, titulo, texto],
  );
}

export interface Noticia {
  id: number;
  tipo: TipoNoticia;
  titulo: string;
  texto: string;
  jornada: number | null;
  temporada: number | null;
}

export async function ultimasNoticias(bd: Consulta, clubId: string, limite: number): Promise<Noticia[]> {
  const { rows } = await bd.query<Noticia>(
    `select n.id::int as id, n.tipo, n.titulo, n.texto, n.jornada, t.numero as temporada
       from noticias n left join temporadas t on t.id = n.temporada_id
      where n.club_id = $1 order by n.id desc limit $2`,
    [clubId, limite],
  );
  return rows;
}
