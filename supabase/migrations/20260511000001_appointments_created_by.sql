-- Audit trail: quién creó cada turno.
--
-- Cubre dos escenarios:
--   - Panel (owner/admin/empleada): created_by = el usuario logueado
--   - Booking público (clienta vía /c/[slug]): created_by = null (lo dejamos
--     en NULL para distinguir "creado online por la clienta" de "creado por
--     alguien del staff")
--
-- El default auth.uid() funciona automáticamente para inserts con sesión
-- Supabase activa. En el path público (admin client sin sesión) queda en NULL,
-- que es lo deseado.

-- auth.uid() como default: en inserts con sesión Supabase (cliente normal con
-- JWT del user) lo rellena automáticamente. Con service_role (admin client) o
-- contexto sin sesión, queda NULL — esto es exactamente lo deseado para el
-- booking público (donde no hay user logueado del staff).
alter table public.appointments
  add column if not exists created_by uuid
    references auth.users(id) on delete set null
    default auth.uid();

-- En filas existentes, NO seteamos created_by porque no sabemos quién las
-- creó. Quedan en NULL ("histórico desconocido").

comment on column public.appointments.created_by is
  'Quien creó el turno (NULL = creado por clienta desde booking público o legacy)';

-- Index opcional para "turnos creados por X" si alguna vez hacemos esa query
create index if not exists idx_appointments_created_by
  on public.appointments(organization_id, created_by)
  where created_by is not null;
