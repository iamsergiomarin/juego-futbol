-- Liga: jornada en los movimientos económicos e índices para el calendario.

alter table movimientos add column jornada smallint;

create index partidos_por_jornada on partidos (temporada_id, grupo_id, competicion, jornada);
create index planteamientos_por_club on planteamientos (club_id);
