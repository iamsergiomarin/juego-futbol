-- Patrocinio: ofertas que llegan en pretemporada, contratos con objetivo y satisfacción.
alter table patrocinios add column prima bigint not null default 0;
alter table patrocinios add column objetivo_posicion smallint;

create table ofertas_patrocinio (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubes (id) on delete cascade,
  temporada_id int not null references temporadas (id),
  espacio text not null check (espacio in ('frontal', 'marca_deportiva')),
  marca text not null,
  perfil text not null check (perfil in ('local', 'multinacional', 'apuestas')),
  fijo bigint not null,
  prima bigint not null,
  objetivo_posicion smallint not null,
  duracion smallint not null check (duracion between 1 and 3),
  margen numeric not null,                 -- oculto: hasta qué subida acepta la marca
  renovacion boolean not null default false,
  contraofertada boolean not null default false,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada', 'retirada')),
  creada_en timestamptz not null default now()
);
create index ofertas_patrocinio_por_club on ofertas_patrocinio (club_id, temporada_id);
