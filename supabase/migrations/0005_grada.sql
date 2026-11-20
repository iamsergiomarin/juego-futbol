-- La Grada: la red social del club. Aficionados, peña, prensa y la cuenta oficial
-- reaccionan a lo que pasa en el campo y en los despachos.

-- Ánimo de la afición (0-100). Sube con las victorias y los fichajes que ilusionan,
-- baja con las derrotas y las ventas que duelen. Solo afecta a la taquilla.
alter table clubes
  add column animo_grada smallint not null default 60 check (animo_grada between 0 and 100);

-- Las cuentas que forman la grada de un club (siempre las mismas: tienen carácter propio)
create table voces_grada (
  id serial primary key,
  club_id uuid not null references clubes (id) on delete cascade,
  tipo text not null check (tipo in ('aficion', 'pena', 'prensa', 'club')),
  nombre text not null,
  usuario text not null,
  rasgo text not null,
  unique (club_id, usuario)
);

create table publicaciones (
  id bigserial primary key,
  club_id uuid not null references clubes (id) on delete cascade,
  temporada_id int references temporadas (id),
  jornada smallint,
  partido_id uuid references partidos (id) on delete set null,
  autor_tipo text not null check (autor_tipo in ('aficion', 'pena', 'prensa', 'club', 'rival')),
  autor_nombre text not null,
  autor_usuario text not null,
  texto text not null,
  tono text not null default 'neutro' check (tono in ('positivo', 'negativo', 'neutro')),
  me_gusta int not null default 0,
  comentarios int not null default 0,
  compartidos int not null default 0,
  respuesta_a bigint references publicaciones (id) on delete cascade,
  -- Fecha dentro del juego (la del partido o la del día en que ocurre)
  fecha timestamptz not null,
  creada_en timestamptz not null default now()
);
create index publicaciones_por_club on publicaciones (club_id, id desc);
create index publicaciones_respuestas on publicaciones (respuesta_a) where respuesta_a is not null;
