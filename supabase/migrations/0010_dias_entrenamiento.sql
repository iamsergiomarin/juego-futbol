-- Los días de entrenamiento entre partidos se juegan de uno en uno: cuántos se han hecho desde el último partido.
alter table temporadas add column dias_entrenados smallint not null default 0;
