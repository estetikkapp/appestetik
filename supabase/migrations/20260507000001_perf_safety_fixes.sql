-- Migration: fixes críticos de seguridad + performance encontrados en auditoría

-- ==========================================
-- HIGH: race condition doble-booking
-- ==========================================
-- Sin este índice, dos reservas concurrentes para el mismo profesional/horario
-- ambas pasan el conflict check y ambas se insertan. Postgres asegura unicidad
-- a nivel constraint si el índice está en su lugar.

create unique index if not exists appointments_pro_slot_active_idx
  on public.appointments (professional_id, starts_at)
  where status in ('pending', 'confirmed', 'in_progress')
    and professional_id is not null;

-- Si el resource_id está set, también única por recurso (cabina/máquina)
create unique index if not exists appointments_resource_slot_active_idx
  on public.appointments (resource_id, starts_at)
  where status in ('pending', 'confirmed', 'in_progress')
    and resource_id is not null;

-- ==========================================
-- HIGH: data loss en treatment_sessions
-- ==========================================
-- ON DELETE CASCADE elimina historial clínico cuando se borra clienta.
-- Cambiar a RESTRICT (la clienta no se puede borrar si tiene sesiones).

alter table public.treatment_sessions
  drop constraint if exists treatment_sessions_client_id_fkey,
  add constraint treatment_sessions_client_id_fkey
    foreign key (client_id) references public.clients(id) on delete restrict;

-- ==========================================
-- MEDIUM: indexes para queries DESC del panel
-- ==========================================

-- /agenda y dashboard ordenan por starts_at desc
create index if not exists appointments_org_starts_desc_idx
  on public.appointments (organization_id, starts_at desc);

-- /cobros ordena por created_at desc
create index if not exists payments_org_created_desc_idx
  on public.payments (organization_id, created_at desc);

-- /audit-log ordena por created_at desc
create index if not exists audit_log_org_created_desc_idx
  on public.audit_log (organization_id, created_at desc);

-- Notifications: el bell hace 2 queries: unread filtered + recent. Ya hay
-- index para unread (parcial WHERE read_at IS NULL) y otro general. OK.

-- ==========================================
-- MEDIUM: búsqueda fuzzy de clientas requiere index combinado
-- ==========================================
-- El index trgm existente en full_name no incluye organization_id, así que
-- el filtro por org se hace por bitmap. Para volumen >10k clientes, esto
-- empieza a doler. Compuesto trgm + btree.

create index if not exists clients_org_phone_idx
  on public.clients (organization_id, phone_e164)
  where phone_e164 is not null;

create index if not exists clients_org_dni_idx
  on public.clients (organization_id, dni)
  where dni is not null;

-- ==========================================
-- MEDIUM: waitlist queries
-- ==========================================

create index if not exists waitlist_org_status_created_desc_idx
  on public.waitlist_entries (organization_id, status, created_at desc);

-- ==========================================
-- LOW: cleanup índice redundante
-- ==========================================
-- El índice clients_org_created_idx ya existe y cubre listados básicos.
-- El nuevo trgm cubre búsqueda. OK.
