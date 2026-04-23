-- Migration: core tables
-- Sprint 1: services, resources, clients, business_hours, invitations

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  buffer_minutes int default 0 check (buffer_minutes >= 0),
  price_ars numeric(12,2) not null check (price_ars >= 0),
  requires_consent boolean default false,
  requires_resource_type text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone_e164 text,
  email text,
  birthdate date,
  dni text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_visit_at timestamptz
);

create trigger set_updated_at_clients
  before update on public.clients
  for each row execute function public.tg_set_updated_at();

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  active boolean not null default true,
  unique (organization_id, day_of_week),
  check ((active = false) or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'professional', 'receptionist')),
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
