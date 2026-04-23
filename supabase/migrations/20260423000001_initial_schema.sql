-- Migration: initial schema
-- Sprint 1: core tenancy tables (organizations + memberships)

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cuit varchar(11),
  tax_condition text check (tax_condition in ('monotributo', 'responsable_inscripto', 'exento')),
  logo_url text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  slug text unique,
  subscription_tier text not null default 'pro',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  onboarded_at timestamptz,
  afip_provider text check (afip_provider in ('tusfacturas', 'direct', 'manual')) default 'manual',
  afip_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'professional', 'receptionist')),
  display_name text,
  commission_rate numeric(5,2) default 0,
  active boolean not null default true,
  invited_by uuid references auth.users(id),
  invitation_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- updated_at trigger generic function (reutilizada en varias tablas)
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_organizations
  before update on public.organizations
  for each row execute function public.tg_set_updated_at();
