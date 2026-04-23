-- Migration: indexes
-- Sprint 1: fuzzy search en clients + compuestos para listados

create extension if not exists pg_trgm;

-- Clients: fuzzy search por nombre + búsqueda exacta por teléfono/DNI
create index clients_full_name_trgm_idx on public.clients using gin (full_name gin_trgm_ops);
create index clients_phone_e164_idx on public.clients (phone_e164);
create index clients_dni_idx on public.clients (dni);
create index clients_org_created_idx on public.clients (organization_id, created_at desc);

-- Services / resources
create index services_org_active_idx on public.services (organization_id, active);
create index resources_org_active_idx on public.resources (organization_id, active);

-- Memberships
create index memberships_user_active_idx on public.memberships (user_id, active);
create index memberships_org_active_idx on public.memberships (organization_id, active);

-- Invitations
create index invitations_email_org_idx on public.invitations (email, organization_id);
