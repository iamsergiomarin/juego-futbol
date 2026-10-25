-- Gestión deportiva: planteamiento, entrenamiento, estado físico, lesiones,
-- mercado, fases de temporada, novedades e historial.

-- Planteamiento por defecto del club (sistema, once, banquillo, táctica, condicionales)
-- y plan de entrenamiento (sesión de cada día sin partido).
alter table clubes
  add column planteamiento jsonb,
  add column entrenamiento jsonb;

alter table jugadores
  add column jornadas_lesion smallint not null default 0 check (jornadas_lesion >= 0),
  add column tipo_lesion text,
  -- Foco individual de entrenamiento: tecnico, fisico, tactico o porteria
  add column foco text check (foco in ('tecnico', 'fisico', 'tactico', 'porteria')),
  -- Progreso acumulado por atributo (al llegar a 1 sube un punto)
  add column progreso jsonb not null default '{}',
  -- Cambios de atributos de la última semana, para el informe
  add column cambios_semana jsonb not null default '{}',
  -- Precio pedido si está en el mercado (null = no está en venta)
  add column precio_venta bigint check (precio_venta > 0);

create index jugadores_en_venta on jugadores (precio_venta) where precio_venta is not null;
create index agentes_libres on jugadores (posicion) where club_id is null and not retirado;

alter table temporadas
  add column fase text not null default 'liga' check (fase in ('liga', 'playoff', 'terminada'));

alter table partidos
  add column ganador_id uuid references clubes (id);

-- Novedades que el cuerpo técnico cuenta al mánager
create table noticias (
  id bigserial primary key,
  club_id uuid not null references clubes (id) on delete cascade,
  temporada_id int references temporadas (id),
  jornada smallint,
  tipo text not null,        -- lesion, entrenamiento, fichaje, venta, contrato, temporada, partido
  titulo text not null,
  texto text not null,
  creada_en timestamptz not null default now()
);
create index noticias_por_club on noticias (club_id, id desc);

-- Cómo terminó cada club cada temporada
create table historial (
  temporada_id int not null references temporadas (id),
  club_id uuid not null references clubes (id) on delete cascade,
  division smallint not null,
  grupo int not null,
  posicion smallint not null,
  puntos smallint not null,
  desenlace text not null,   -- campeon, ascenso, playoff, permanencia, descenso
  primary key (temporada_id, club_id)
);
