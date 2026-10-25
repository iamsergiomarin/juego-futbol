-- =============================================================================
-- Esquema inicial · juego mánager de fútbol
-- PostgreSQL (Supabase). Los usuarios viven en auth.users (registro de Supabase).
-- Importes en euros del juego, como bigint (sin decimales).
-- =============================================================================

-- gen_random_uuid() viene incluido en PostgreSQL 13+ (Supabase y la base local).

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type posicion as enum ('POR', 'DEF', 'MED', 'DEL');
create type tipo_ficha as enum ('primer_equipo', 'filial', 'academia');
create type personalidad as enum ('profesional', 'lider', 'ambicioso', 'conflictivo', 'timido', 'normal');
create type perfil_bot as enum ('equilibrado', 'defensivo', 'cantera', 'gastador');
create type competicion as enum ('liga', 'playoff', 'copa', 'filial', 'continental', 'amistoso');
create type estado_partido as enum ('programado', 'en_juego', 'finalizado');
create type mentalidad as enum ('defensiva', 'equilibrada', 'ofensiva');
create type presion as enum ('baja', 'normal', 'alta');
create type puesto_personal as enum (
  'segundo_entrenador', 'preparador_fisico', 'medico', 'fisioterapeuta', 'entrenador_porteros',
  'ojeador', 'analista', 'entrenador_cantera', 'entrenador_filial', 'psicologo', 'nutricionista'
);
create type categoria_personal as enum ('basico', 'regional', 'nacional', 'elite');
create type tipo_edificio as enum ('estadio', 'sede', 'ciudad_deportiva', 'centro_medico', 'escuela_cantera');
create type estado_obra as enum ('en_curso', 'terminada', 'cancelada');

-- -----------------------------------------------------------------------------
-- Mánagers (perfil de juego de cada usuario)
-- -----------------------------------------------------------------------------
create table managers (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  nivel int not null default 1,
  experiencia int not null default 0,
  socio_fundador boolean not null default false,
  tutorial_completado boolean not null default false,
  ultima_conexion timestamptz not null default now(),
  creado_en timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Estructura de competición
-- -----------------------------------------------------------------------------
create table temporadas (
  id serial primary key,
  numero int not null unique,
  inicio date not null,
  fin date not null,
  actual boolean not null default false
);
create unique index una_temporada_actual on temporadas (actual) where actual;

create table divisiones (
  nivel smallint primary key check (nivel between 0 and 5), -- 0 = Élite … 5 = Quinta
  nombre text not null,
  desbloqueada boolean not null default false
);

insert into divisiones (nivel, nombre, desbloqueada) values
  (0, 'Élite', false), (1, 'Primera', true), (2, 'Segunda', true),
  (3, 'Tercera', true), (4, 'Cuarta', true), (5, 'Quinta', true);

create table grupos (
  id serial primary key,
  division smallint not null references divisiones (nivel),
  numero int not null,
  -- Grupo de la división superior al que alimenta este grupo (ascensos y descensos)
  grupo_superior int references grupos (id),
  abierto boolean not null default false,
  unique (division, numero)
);

-- -----------------------------------------------------------------------------
-- Clubes
-- -----------------------------------------------------------------------------
create table clubes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_corto text,
  manager_id uuid references managers (id) on delete set null, -- null = bot
  perfil_bot perfil_bot,
  grupo_id int references grupos (id),
  -- Clubes de un mismo mánager (hasta 3): nunca en la misma división
  orden_en_grupo_empresarial smallint check (orden_en_grupo_empresarial between 1 and 3),
  dinero bigint not null default 0,
  masa_social int not null default 500,
  popularidad smallint not null default 50 check (popularidad between 0 and 100),
  porcentaje_cantera smallint not null default 0 check (porcentaje_cantera between 0 and 100),
  inactivo_desde timestamptz,
  creado_en timestamptz not null default now(),
  check ((manager_id is null) = (perfil_bot is not null))
);
create index clubes_por_grupo on clubes (grupo_id);
create index clubes_por_manager on clubes (manager_id);

-- -----------------------------------------------------------------------------
-- Jugadores
-- -----------------------------------------------------------------------------
create table jugadores (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubes (id) on delete set null, -- null = agente libre
  nombre text not null,
  apellido text not null,
  fecha_nacimiento date not null,
  nacionalidad text not null default 'ES',
  posicion posicion not null,
  posiciones_secundarias jsonb not null default '{}', -- {"DEF": 0.75}
  atributos jsonb not null,                           -- escala 1-100
  media numeric(3, 1) not null,                       -- escala 1-10, calculada por la aplicación
  potencial smallint not null,                        -- oculto: techo de media x10
  personalidad personalidad not null default 'normal',
  ficha tipo_ficha not null default 'primer_equipo',
  contrato_formacion boolean not null default false,
  contrato_hasta int,                                 -- número de temporada
  salario bigint not null default 0,                  -- por temporada
  clausula bigint,
  valor_mercado bigint not null default 0,
  forma smallint not null default 50,
  moral smallint not null default 50,
  cansancio numeric(3, 2) not null default 0,
  lesion_hasta date,
  partidos_sancion smallint not null default 0,
  partidos_primer_equipo_temporada smallint not null default 0,
  club_formador uuid references clubes (id),          -- derechos de formación
  no_vender_hasta timestamptz,                        -- antiespeculación tras un fichaje
  retirado boolean not null default false,
  creado_en timestamptz not null default now()
);
create index jugadores_por_club on jugadores (club_id);

-- -----------------------------------------------------------------------------
-- Partidos y clasificación
-- -----------------------------------------------------------------------------
create table partidos (
  id uuid primary key default gen_random_uuid(),
  temporada_id int not null references temporadas (id),
  competicion competicion not null,
  grupo_id int references grupos (id),
  jornada int,
  ronda text,                                         -- copa y playoff
  local_id uuid not null references clubes (id),
  visitante_id uuid not null references clubes (id),
  inicio timestamptz not null,
  estado estado_partido not null default 'programado',
  minuto smallint not null default 0,
  semilla bigint not null,
  goles_local smallint,
  goles_visitante smallint,
  estadisticas jsonb,                                 -- tiros, posesión, xG
  eventos jsonb not null default '[]',
  asistencia int,
  check (local_id <> visitante_id)
);
create index partidos_por_inicio on partidos (inicio) where estado <> 'finalizado';
create index partidos_por_club_local on partidos (local_id);
create index partidos_por_club_visitante on partidos (visitante_id);

-- Planteamiento de cada equipo para un partido (alineación, táctica y condicionales)
create table planteamientos (
  partido_id uuid not null references partidos (id) on delete cascade,
  club_id uuid not null references clubes (id),
  titulares uuid[] not null,
  banquillo uuid[] not null,
  formacion text not null default '4-4-2',
  mentalidad mentalidad not null default 'equilibrada',
  presion presion not null default 'normal',
  condicionales jsonb not null default '[]',
  primary key (partido_id, club_id)
);

-- Órdenes dadas en directo; el simulador las aplica en la siguiente interrupción
create table ordenes_partido (
  id bigserial primary key,
  partido_id uuid not null references partidos (id) on delete cascade,
  club_id uuid not null references clubes (id),
  orden jsonb not null,
  creada_en timestamptz not null default now(),
  aplicada_en_minuto smallint
);

create table clasificacion (
  temporada_id int not null references temporadas (id),
  grupo_id int not null references grupos (id),
  club_id uuid not null references clubes (id),
  jugados smallint not null default 0,
  ganados smallint not null default 0,
  empatados smallint not null default 0,
  perdidos smallint not null default 0,
  goles_favor smallint not null default 0,
  goles_contra smallint not null default 0,
  puntos smallint not null default 0,
  primary key (temporada_id, grupo_id, club_id)
);

-- -----------------------------------------------------------------------------
-- Instalaciones: edificios contenedor con áreas (tres llaves: nivel de mánager,
-- nivel del edificio y pago). Ninguna área supera el nivel de su edificio.
-- -----------------------------------------------------------------------------
create table edificios (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubes (id) on delete cascade,
  tipo tipo_edificio not null,
  nivel smallint not null default 0,
  unique (club_id, tipo)
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references edificios (id) on delete cascade,
  tipo text not null,          -- direccion_deportiva, oficina_ojeadores, sala_video, quioscos…
  nivel smallint not null default 0,
  unique (edificio_id, tipo)
);

-- Sectores del estadio: cuatro gradas y esquinas, palcos, césped, iluminación…
create table sectores_estadio (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubes (id) on delete cascade,
  sector text not null,        -- tribuna, fondo_norte, esquina_ne, palcos, cesped…
  nivel smallint not null default 0,
  aforo int not null default 0,
  cubierta boolean not null default false,
  puntos_venta smallint not null default 0,
  unique (club_id, sector)
);

create table obras (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubes (id) on delete cascade,
  objetivo text not null,      -- 'sector:fondo_norte' o 'area:oficina_ojeadores'
  nivel_destino smallint not null,
  coste bigint not null,
  inicio timestamptz not null default now(),
  fin timestamptz not null check (fin <= inicio + interval '48 hours'),
  estado estado_obra not null default 'en_curso'
);
create index obras_en_curso on obras (fin) where estado = 'en_curso';

-- -----------------------------------------------------------------------------
-- Cuerpo técnico (mercado de personal libre: club_id null)
-- -----------------------------------------------------------------------------
create table personal (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubes (id) on delete set null,
  nombre text not null,
  puesto puesto_personal not null,
  categoria categoria_personal not null default 'basico',
  calidad smallint not null check (calidad between 1 and 100),
  experiencia_en_club smallint not null default 0,
  salario bigint not null,
  contrato_hasta int,
  ex_jugador_id uuid references jugadores (id)
);

-- -----------------------------------------------------------------------------
-- Economía: libro de movimientos (taquilla, salarios, patrocinios, traspasos…)
-- -----------------------------------------------------------------------------
create table movimientos (
  id bigserial primary key,
  club_id uuid not null references clubes (id) on delete cascade,
  temporada_id int not null references temporadas (id),
  concepto text not null,
  importe bigint not null,     -- positivo ingreso, negativo gasto
  creado_en timestamptz not null default now()
);
create index movimientos_por_club on movimientos (club_id, temporada_id);

create table patrocinios (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubes (id) on delete cascade,
  marca text not null,
  perfil text not null,        -- local, multinacional, apuestas
  espacio text not null,       -- frontal, manga, marca_deportiva, vallas, estadio…
  fijo_por_temporada bigint not null,
  variables jsonb not null default '[]',
  desde_temporada int not null,
  hasta_temporada int not null,
  satisfaccion smallint not null default 50
);

-- -----------------------------------------------------------------------------
-- Mercado: subastas y ofertas directas
-- -----------------------------------------------------------------------------
create table subastas (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references jugadores (id) on delete cascade,
  vendedor_id uuid not null references clubes (id),
  precio_salida bigint not null,
  fin timestamptz not null,
  puja_actual bigint,
  pujador_id uuid references clubes (id),
  cerrada boolean not null default false
);

create table ofertas (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references jugadores (id) on delete cascade,
  comprador_id uuid not null references clubes (id),
  vendedor_id uuid not null references clubes (id),
  importe bigint not null,
  tipo text not null default 'traspaso', -- traspaso, cesion
  estado text not null default 'pendiente', -- pendiente, aceptada, rechazada, contraoferta
  contraoferta bigint,
  creada_en timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Seguridad: cada mánager solo modifica lo suyo. Las lecturas públicas
-- (clasificaciones, partidos) se abren con políticas específicas.
-- -----------------------------------------------------------------------------
alter table managers enable row level security;
alter table clubes enable row level security;
alter table jugadores enable row level security;
alter table partidos enable row level security;
alter table planteamientos enable row level security;
alter table ordenes_partido enable row level security;
alter table clasificacion enable row level security;
alter table movimientos enable row level security;

create policy "cada mánager ve su perfil" on managers for select using (auth.uid() = id);
create policy "cada mánager edita su perfil" on managers for update using (auth.uid() = id);
create policy "clubes visibles para todos" on clubes for select using (true);
create policy "jugadores visibles para todos" on jugadores for select using (true);
create policy "partidos visibles para todos" on partidos for select using (true);
create policy "clasificación visible para todos" on clasificacion for select using (true);
create policy "planteamiento propio" on planteamientos for all
  using (exists (select 1 from clubes c where c.id = club_id and c.manager_id = auth.uid()));
create policy "órdenes propias" on ordenes_partido for insert
  with check (exists (select 1 from clubes c where c.id = club_id and c.manager_id = auth.uid()));
create policy "movimientos propios" on movimientos for select
  using (exists (select 1 from clubes c where c.id = club_id and c.manager_id = auth.uid()));
