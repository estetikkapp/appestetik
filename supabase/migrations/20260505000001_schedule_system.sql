-- Migration: schedule templates + professional services + security code en appointments
-- Adaptación del modelo turnos UTN-FRT al dominio estética (multi-profesional).

-- ==========================================
-- Schedule templates reutilizables por org
-- ==========================================
-- Una plantilla define ventanas de atención por día de semana + granularidad
-- de slots. Múltiples profesionales pueden compartir la misma plantilla.

create table if not exists public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- attention_windows: jsonb array of objects:
  --   [{"weekday": 1, "start_time": "09:00", "end_time": "13:00"}, ...]
  --   weekday 0=Domingo, 1=Lunes, ..., 6=Sábado
  attention_windows jsonb not null default '[]'::jsonb,
  -- Granularidad del slot picker (15, 20, 30, 60 min). El service.duration
  -- define cuántos slots consecutivos ocupa cada turno.
  slot_minutes int not null default 30 check (slot_minutes > 0 and slot_minutes <= 240),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_schedule_templates
  before update on public.schedule_templates
  for each row execute function public.tg_set_updated_at();

-- Solo una default por org
create unique index if not exists schedule_templates_org_default_idx
  on public.schedule_templates (organization_id)
  where is_default = true;

create index if not exists schedule_templates_org_active_idx
  on public.schedule_templates (organization_id, active);

alter table public.schedule_templates enable row level security;

create policy "members see schedule templates" on public.schedule_templates
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage schedule templates" on public.schedule_templates
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- Asignar plantilla a profesional (via membership)
-- ==========================================

alter table public.memberships
  add column if not exists schedule_template_id uuid
    references public.schedule_templates(id) on delete set null;

create index if not exists memberships_template_idx
  on public.memberships (schedule_template_id)
  where schedule_template_id is not null;

-- ==========================================
-- Servicios que ofrece cada profesional
-- ==========================================
-- M:N entre memberships (profesionales) y services.
-- Si una profesional NO tiene servicios asignados → puede hacer todos.
-- Si tiene al menos uno → solo puede hacer esos.

create table if not exists public.professional_services (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, service_id)
);

create index if not exists professional_services_org_idx
  on public.professional_services (organization_id);
create index if not exists professional_services_service_idx
  on public.professional_services (service_id);

alter table public.professional_services enable row level security;

create policy "members see professional services" on public.professional_services
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage professional services" on public.professional_services
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- Security code para cancelación pública
-- ==========================================

alter table public.appointments
  add column if not exists security_code_hash text,
  add column if not exists cancellation_attempts int not null default 0,
  add column if not exists last_cancellation_attempt_at timestamptz;

-- Index para búsqueda rápida cuando la clienta intenta cancelar (por id + verificación de hash)
-- (no necesitamos uno extra, el id ya es PK)

-- ==========================================
-- Closures: agregar all_day + reason obligatorio para soportar dry-run
-- ==========================================
-- schedule_blocks ya existe con starts_at + ends_at. Agregamos all_day flag
-- (cuando true, el cierre cubre días enteros — útil para vacaciones).

alter table public.schedule_blocks
  add column if not exists all_day boolean not null default true,
  add column if not exists notified_at timestamptz;

-- reason ya existe y es NOT NULL en la migración original. OK.
