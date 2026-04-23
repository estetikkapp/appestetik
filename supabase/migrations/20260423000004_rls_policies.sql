-- Migration: RLS policies
-- Sprint 1: tenant isolation + role-based access

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.services enable row level security;
alter table public.resources enable row level security;
alter table public.clients enable row level security;
alter table public.business_hours enable row level security;
alter table public.invitations enable row level security;

-- Helper function: devuelve org_ids activos del user autenticado
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select organization_id from public.memberships
  where user_id = auth.uid() and active = true;
$$;

-- Helper: true si el user es owner/admin de la org
create or replace function public.user_is_org_admin(org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and organization_id = org_id
      and active = true
      and role in ('owner', 'admin')
  );
$$;

-- ==========================================
-- organizations
-- ==========================================
create policy "members select own orgs" on public.organizations
  for select using (id in (select public.user_org_ids()));

create policy "owner admin update org" on public.organizations
  for update using (public.user_is_org_admin(id));

-- INSERT de organizations lo hace el trigger (security definer) — no policy para users directos

-- ==========================================
-- memberships
-- ==========================================
create policy "users see own memberships" on public.memberships
  for select using (user_id = auth.uid());

create policy "owner admin see org memberships" on public.memberships
  for select using (public.user_is_org_admin(organization_id));

create policy "owner admin insert memberships" on public.memberships
  for insert with check (public.user_is_org_admin(organization_id));

create policy "owner admin update memberships" on public.memberships
  for update using (public.user_is_org_admin(organization_id));

create policy "owner admin delete memberships" on public.memberships
  for delete using (public.user_is_org_admin(organization_id));

-- ==========================================
-- services
-- ==========================================
create policy "members see services" on public.services
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage services" on public.services
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- resources
-- ==========================================
create policy "members see resources" on public.resources
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage resources" on public.resources
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- clients (receptionist también puede gestionar)
-- ==========================================
create policy "members see clients" on public.clients
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff insert clients" on public.clients
  for insert with check (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

create policy "staff update clients" on public.clients
  for update using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

create policy "owner admin delete clients" on public.clients
  for delete using (public.user_is_org_admin(organization_id));

-- ==========================================
-- business_hours
-- ==========================================
create policy "members see business hours" on public.business_hours
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage business hours" on public.business_hours
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- invitations (solo owner/admin)
-- ==========================================
create policy "owner admin manage invitations" on public.invitations
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));
