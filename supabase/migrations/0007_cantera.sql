-- Cantera: juveniles de la academia (fuera del primer equipo hasta que se les da contrato profesional).
create table juveniles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubes (id) on delete cascade,
  temporada_id int not null references temporadas (id),
  hornada text not null check (hornada in ('pretemporada', 'mitad', 'inauguracion')),
  nombre text not null,
  apellido text not null,
  fecha_nacimiento date not null,
  posicion posicion not null,
  atributos jsonb not null,           -- decimales: crecen poco a poco
  media numeric(3, 1) not null,
  potencial smallint not null,        -- oculto
  personalidad personalidad not null default 'normal',
  joya boolean not null default false,
  estado text not null default 'academia' check (estado in ('academia', 'subido', 'liberado')),
  creado_en timestamptz not null default now()
);
create index juveniles_por_club on juveniles (club_id, estado);
