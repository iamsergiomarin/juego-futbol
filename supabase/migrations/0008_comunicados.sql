-- Comunicados del club en La Grada: marca de la publicación inicial para limitarlos por jornada.
alter table publicaciones add column comunicado boolean not null default false;
