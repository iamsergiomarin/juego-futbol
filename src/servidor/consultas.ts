import { bdLocal, modoLocal } from "./bd";

export interface ManagerLocal {
  id: string;
  nombre: string;
  nivel: number;
  clubId: string;
}

/** En modo local hay un único mánager: el dueño del ordenador. */
export async function managerLocal(): Promise<ManagerLocal | null> {
  if (!modoLocal()) return null;
  const bd = await bdLocal();
  const { rows } = await bd.query<ManagerLocal>(
    `select m.id, m.nombre, m.nivel, c.id as "clubId"
       from managers m join clubes c on c.manager_id = m.id
      order by c.orden_en_grupo_empresarial limit 1`,
  );
  return rows[0] ?? null;
}

export interface JugadorFicha {
  id: string;
  dorsal: number | null;
  nombre: string;
  apellido: string;
  posicion: "POR" | "DEF" | "MED" | "DEL";
  edad: number;
  media: number;
  valor: number;
  salario: number;
  contratoHasta: number | null;
  personalidad: string;
}

export interface FichaClub {
  id: string;
  nombre: string;
  corto: string;
  ciudad: string;
  colorPrincipal: string;
  colorSecundario: string;
  dinero: number;
  masaSocial: number;
  popularidad: number;
  manager: string;
  division: string;
  grupo: number;
  temporada: { numero: number; inicio: string; fin: string };
  aforo: number;
  plantilla: JugadorFicha[];
  personal: { nombre: string; puesto: string; calidad: number; salario: number }[];
  edificios: { tipo: string; nivel: number; areas: { tipo: string; nivel: number }[] }[];
  rivales: { nombre: string; colorPrincipal: string; colorSecundario: string; media: number }[];
}

export async function fichaClub(clubId: string): Promise<FichaClub | null> {
  const bd = await bdLocal();
  const club = (
    await bd.query<Omit<FichaClub, "plantilla" | "personal" | "edificios" | "rivales" | "temporada" | "aforo"> & {
      grupoId: number; tnumero: number; tinicio: string; tfin: string;
    }>(
      `select c.id, c.nombre, c.nombre_corto as corto, c.ciudad, c.color_principal as "colorPrincipal",
              c.color_secundario as "colorSecundario", c.dinero::float8 as dinero, c.masa_social as "masaSocial",
              c.popularidad, m.nombre as manager, d.nombre as division, g.numero as grupo, g.id as "grupoId",
              t.numero as tnumero, to_char(t.inicio, 'YYYY-MM-DD') as tinicio, to_char(t.fin, 'YYYY-MM-DD') as tfin
         from clubes c
         join grupos g on g.id = c.grupo_id
         join divisiones d on d.nivel = g.division
         left join managers m on m.id = c.manager_id
         cross join lateral (select * from temporadas where actual) t
        where c.id = $1`,
      [clubId],
    )
  ).rows[0];
  if (!club) return null;

  const plantilla = (
    await bd.query<JugadorFicha>(
      `select j.id, j.dorsal, j.nombre, j.apellido, j.posicion,
              date_part('year', age((select inicio from temporadas where actual), j.fecha_nacimiento))::int as edad,
              j.media::float8 as media, j.valor_mercado::float8 as valor, j.salario::float8 as salario,
              j.contrato_hasta as "contratoHasta", j.personalidad
         from jugadores j where j.club_id = $1 and j.ficha = 'primer_equipo'
        order by array_position(array['POR','DEF','MED','DEL']::posicion[], j.posicion), j.media desc`,
      [clubId],
    )
  ).rows;

  const personal = (
    await bd.query<FichaClub["personal"][number]>(
      `select nombre, puesto, calidad, salario::float8 as salario from personal where club_id = $1
        order by array_position(array['segundo_entrenador','preparador_fisico','ojeador']::puesto_personal[], puesto)`,
      [clubId],
    )
  ).rows;

  const edificios = (
    await bd.query<FichaClub["edificios"][number]>(
      `select e.tipo, e.nivel,
              coalesce(json_agg(json_build_object('tipo', a.tipo, 'nivel', a.nivel) order by a.tipo)
                       filter (where a.id is not null), '[]') as areas
         from edificios e left join areas a on a.edificio_id = e.id
        where e.club_id = $1 group by e.id
        order by array_position(array['estadio','sede','ciudad_deportiva','centro_medico','escuela_cantera']::tipo_edificio[], e.tipo)`,
      [clubId],
    )
  ).rows;

  const aforo = (
    await bd.query<{ aforo: number }>("select coalesce(sum(aforo), 0)::int as aforo from sectores_estadio where club_id = $1", [clubId])
  ).rows[0].aforo;

  const rivales = (
    await bd.query<FichaClub["rivales"][number]>(
      `select c.nombre, c.color_principal as "colorPrincipal", c.color_secundario as "colorSecundario",
              round(avg(j.media), 1)::float8 as media
         from clubes c join jugadores j on j.club_id = c.id
        where c.grupo_id = $1 and c.id <> $2
        group by c.id order by c.nombre`,
      [club.grupoId, clubId],
    )
  ).rows;

  return {
    id: club.id,
    nombre: club.nombre,
    corto: club.corto,
    ciudad: club.ciudad,
    colorPrincipal: club.colorPrincipal,
    colorSecundario: club.colorSecundario,
    dinero: club.dinero,
    masaSocial: club.masaSocial,
    popularidad: club.popularidad,
    manager: club.manager,
    division: club.division,
    grupo: club.grupo,
    temporada: { numero: club.tnumero, inicio: club.tinicio, fin: club.tfin },
    aforo,
    plantilla,
    personal,
    edificios,
    rivales,
  };
}
