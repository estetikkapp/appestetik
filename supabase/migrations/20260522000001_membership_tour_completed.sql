-- Welcome tour de bienvenida — track de quien ya lo vio.
--
-- NULL  = todavía no terminó el tour (o nunca lo arrancó)
-- NOT NULL = timestamp de cuando lo terminó/saltó
--
-- Por user (no por org). Es decir: si una persona tiene 2 orgs y vio el
-- tour en una, lo ve igual en la otra — el contexto del tour cambia
-- según las features de la org activa.
--
-- Por rol: hoy solo se dispara para owner (decisión del owner del producto).
-- Si en el futuro queremos también para admin/profesional, no hay que
-- migrar nada — el código decide si lo muestra.

alter table public.memberships
  add column if not exists tour_completed_at timestamptz;

comment on column public.memberships.tour_completed_at is
  'Cuándo este user terminó o saltó el tour de bienvenida en su panel. NULL = no lo vio todavía. El botón "Ver tour de nuevo" en /configuracion vuelve esto a NULL.';
