-- Identidad del club (colores del escudo y ciudad) y dorsales.

alter table clubes
  add column color_principal text not null default '#1f6b3a' check (color_principal ~ '^#[0-9a-fA-F]{6}$'),
  add column color_secundario text not null default '#ffffff' check (color_secundario ~ '^#[0-9a-fA-F]{6}$'),
  add column ciudad text;

alter table jugadores
  add column dorsal smallint check (dorsal between 1 and 99);

-- Un mánager solo puede tener un club por orden dentro de su grupo empresarial.
create unique index un_club_por_orden on clubes (manager_id, orden_en_grupo_empresarial)
  where manager_id is not null;
