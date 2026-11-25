-- Filial: los juveniles pueden pasar de la academia al filial y el filial juega su propia liga (una vuelta, domingos).
alter table juveniles drop constraint juveniles_estado_check;
alter table juveniles add constraint juveniles_estado_check check (estado in ('academia', 'filial', 'subido', 'liberado'));
alter table juveniles add column partidos_filial smallint not null default 0;

create table partidos_filial (
  id uuid primary key default gen_random_uuid(),
  temporada_id int not null references temporadas (id),
  grupo_id int not null references grupos (id),
  jornada smallint not null,
  local_id uuid not null references clubes (id),
  visitante_id uuid not null references clubes (id),
  inicio timestamptz not null,
  semilla int not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'finalizado')),
  goles_local smallint,
  goles_visitante smallint
);
create index partidos_filial_por_jornada on partidos_filial (temporada_id, jornada);
create index partidos_filial_por_club on partidos_filial (local_id, visitante_id);
