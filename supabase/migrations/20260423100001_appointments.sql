-- Migration: appointments + schedule blocks
-- Sprint 2: agenda/calendario

create type appointment_status as enum (
  'pending',       -- creado, falta confirmar
  'confirmed',     -- confirmado (por clienta o empleada)
  'in_progress',   -- en curso (se hizo check-in)
  'completed',     -- finalizado
  'cancelled',     -- cancelado (con antelación)
  'no_show'        -- clienta no vino
);

create type appointment_source as enum (
  'panel',         -- cargado desde el panel por empleada
  'public',        -- reserva pública del /c/[slug]
  'waitlist'       -- asignado automáticamente desde lista de espera
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  professional_id uuid references auth.users(id) on delete set null,
  resource_id uuid references public.resources(id) on delete set null,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'pending',
  source appointment_source not null default 'panel',
  notes text,
  reminder_sent_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create trigger set_updated_at_appointments
  before update on public.appointments
  for each row execute function public.tg_set_updated_at();

-- Bloques de agenda (vacaciones, mantenimiento, cierre)
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid references auth.users(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Índices para performance del calendar (queries por rango + org)
create index appointments_org_starts_idx on public.appointments (organization_id, starts_at);
create index appointments_org_status_starts_idx on public.appointments (organization_id, status, starts_at);
create index appointments_professional_idx on public.appointments (professional_id, starts_at) where professional_id is not null;
create index appointments_resource_idx on public.appointments (resource_id, starts_at) where resource_id is not null;
create index appointments_client_idx on public.appointments (client_id, starts_at desc);

create index schedule_blocks_org_range_idx on public.schedule_blocks (organization_id, starts_at, ends_at);
create index schedule_blocks_professional_idx on public.schedule_blocks (professional_id, starts_at) where professional_id is not null;
create index schedule_blocks_resource_idx on public.schedule_blocks (resource_id, starts_at) where resource_id is not null;

-- RLS
alter table public.appointments enable row level security;
alter table public.schedule_blocks enable row level security;

create policy "members see appointments" on public.appointments
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff insert appointments" on public.appointments
  for insert with check (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist', 'professional')
    )
  );

create policy "staff update appointments" on public.appointments
  for update using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist', 'professional')
    )
  );

create policy "owner admin delete appointments" on public.appointments
  for delete using (public.user_is_org_admin(organization_id));

create policy "members see schedule blocks" on public.schedule_blocks
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage schedule blocks" on public.schedule_blocks
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- Actualizar last_visit_at en clients cuando se completa un appointment
create or replace function public.tg_update_client_last_visit()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is null or old.status != 'completed') then
    update public.clients
    set last_visit_at = now()
    where id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger update_client_last_visit
  after update on public.appointments
  for each row execute function public.tg_update_client_last_visit();
