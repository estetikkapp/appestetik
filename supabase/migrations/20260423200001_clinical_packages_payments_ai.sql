-- Migration: clinical records + packages + waitlist + payments + AI features
-- Sprint 4 + Sprint 5 + Sprint 3 (parcial) + Sprint 2 (waitlist)

-- ==========================================
-- Ficha clínica
-- ==========================================

-- Datos médicos sensibles separados de clients (Ley 25.326 compliance)
create table public.client_medical_info (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  allergies text,
  medications text,
  pregnancy_status text check (pregnancy_status in ('no', 'si', 'lactancia', 'trying', 'unknown')),
  skin_type text check (skin_type in ('I', 'II', 'III', 'IV', 'V', 'VI')), -- Fitzpatrick
  contraindications text,
  consent_signed_at timestamptz,
  consent_signature_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_client_medical_info
  before update on public.client_medical_info
  for each row execute function public.tg_set_updated_at();

alter table public.client_medical_info enable row level security;

create policy "members see medical info" on public.client_medical_info
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage medical info" on public.client_medical_info
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'professional', 'receptionist')
    )
  );

-- Sesiones de tratamiento (registro clínico por turno completado)
create table public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  professional_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  performed_at timestamptz not null,
  parameters jsonb default '{}'::jsonb, -- joules, passes, zone, etc.
  photos_before_urls text[] default array[]::text[],
  photos_after_urls text[] default array[]::text[],
  products_used text,
  notes text,
  created_at timestamptz not null default now()
);

create index treatment_sessions_client_idx on public.treatment_sessions (client_id, performed_at desc);
create index treatment_sessions_org_idx on public.treatment_sessions (organization_id, performed_at desc);

alter table public.treatment_sessions enable row level security;

create policy "members see treatment sessions" on public.treatment_sessions
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage treatment sessions" on public.treatment_sessions
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'professional')
    )
  );

-- ==========================================
-- Paquetes y bonos prepagos
-- ==========================================

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  service_id uuid references public.services(id) on delete set null,
  sessions_total int not null check (sessions_total > 0),
  validity_days int not null default 365 check (validity_days > 0),
  price_ars numeric(12,2) not null check (price_ars >= 0),
  discount_percentage numeric(5,2) default 0 check (discount_percentage >= 0 and discount_percentage <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index packages_org_active_idx on public.packages (organization_id, active);

alter table public.packages enable row level security;

create policy "members see packages" on public.packages
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage packages" on public.packages
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- Paquetes asignados a clientas
create table public.client_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  sessions_remaining int not null check (sessions_remaining >= 0),
  expires_at timestamptz not null,
  purchase_price_ars numeric(12,2) not null,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'refunded')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_client_packages
  before update on public.client_packages
  for each row execute function public.tg_set_updated_at();

create index client_packages_client_idx on public.client_packages (client_id, status, expires_at);
create index client_packages_org_idx on public.client_packages (organization_id, status);

alter table public.client_packages enable row level security;

create policy "members see client packages" on public.client_packages
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage client packages" on public.client_packages
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

-- ==========================================
-- Lista de espera
-- ==========================================

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  preferred_date date,
  notes text,
  notified_at timestamptz,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'cancelled')),
  created_at timestamptz not null default now()
);

create index waitlist_org_status_idx on public.waitlist_entries (organization_id, status, created_at);

alter table public.waitlist_entries enable row level security;

create policy "members see waitlist" on public.waitlist_entries
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage waitlist" on public.waitlist_entries
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist', 'professional')
    )
  );

-- ==========================================
-- Pagos y facturación
-- ==========================================

create type payment_method as enum ('cash', 'mp_card', 'mp_link', 'transfer', 'package_credit');
create type payment_status as enum ('pending', 'approved', 'rejected', 'refunded', 'cancelled');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_package_id uuid references public.client_packages(id) on delete set null,
  amount_ars numeric(12,2) not null check (amount_ars >= 0),
  method payment_method not null,
  status payment_status not null default 'pending',
  mp_payment_id text,
  mp_preference_id text,
  mp_payment_link text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_payments
  before update on public.payments
  for each row execute function public.tg_set_updated_at();

create index payments_org_status_idx on public.payments (organization_id, status, created_at desc);
create index payments_client_idx on public.payments (client_id, created_at desc);
create index payments_mp_payment_idx on public.payments (mp_payment_id) where mp_payment_id is not null;

alter table public.payments enable row level security;

create policy "members see payments" on public.payments
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage payments" on public.payments
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

-- Facturas AFIP
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_type text not null check (invoice_type in ('A', 'B', 'C', 'M', 'internal')),
  invoice_number text,
  cae text,
  cae_due_date date,
  issued_at timestamptz not null default now(),
  total_ars numeric(12,2) not null,
  pdf_url text,
  is_fiscal boolean not null default false,
  provider text check (provider in ('tusfacturas', 'direct', 'manual')),
  provider_response jsonb,
  created_at timestamptz not null default now()
);

create index invoices_org_idx on public.invoices (organization_id, issued_at desc);
create index invoices_payment_idx on public.invoices (payment_id);

alter table public.invoices enable row level security;

create policy "members see invoices" on public.invoices
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage invoices" on public.invoices
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- Features de IA
-- ==========================================

create table public.skin_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  photo_url text not null,
  client_age int,
  client_objective text,
  technical_analysis jsonb,
  ai_report jsonb, -- { summary, findings[], recommendations[], home_care[] }
  scores jsonb, -- { hydration, spots, wrinkles, pores, redness, acne, elasticity }
  recommended_service_ids uuid[] default array[]::uuid[],
  pdf_url text,
  created_at timestamptz not null default now()
);

create index skin_analyses_client_idx on public.skin_analyses (client_id, created_at desc);
create index skin_analyses_org_idx on public.skin_analyses (organization_id, created_at desc);

alter table public.skin_analyses enable row level security;

create policy "members see skin analyses" on public.skin_analyses
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage skin analyses" on public.skin_analyses
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'professional')
    )
  );

create table public.treatment_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  skin_analysis_id uuid references public.skin_analyses(id) on delete set null,
  objective text not null,
  client_input jsonb, -- { budget_range, availability, body_zones, contraindications }
  ai_protocol jsonb, -- { phases[], total_sessions, total_duration_months, total_price_ars }
  total_sessions int,
  total_price_ars numeric(12,2),
  status text not null default 'draft' check (status in ('draft', 'presented', 'accepted', 'rejected', 'expired')),
  accepted_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_treatment_protocols
  before update on public.treatment_protocols
  for each row execute function public.tg_set_updated_at();

create index treatment_protocols_client_idx on public.treatment_protocols (client_id, created_at desc);
create index treatment_protocols_org_idx on public.treatment_protocols (organization_id, status);

alter table public.treatment_protocols enable row level security;

create policy "members see protocols" on public.treatment_protocols
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage protocols" on public.treatment_protocols
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'professional')
    )
  );

-- ==========================================
-- Loyalty (Sprint 6)
-- ==========================================

create table public.loyalty_points (
  client_id uuid primary key references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  lifetime_earned int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_loyalty_points
  before update on public.loyalty_points
  for each row execute function public.tg_set_updated_at();

alter table public.loyalty_points enable row level security;

create policy "members see loyalty" on public.loyalty_points
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff manage loyalty" on public.loyalty_points
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

-- ==========================================
-- Storage buckets adicionales
-- ==========================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-photos', 'client-photos', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('skin-analyses', 'skin-analyses', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('consents', 'consents', false, 5242880, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do nothing;

-- Policies para los nuevos buckets (mismo patrón: org_id en primer segmento del path)
create policy "staff read client photos" on storage.objects
  for select using (
    bucket_id = 'client-photos'
    and ((storage.foldername(name))[1])::uuid in (select public.user_org_ids())
  );

create policy "staff insert client photos" on storage.objects
  for insert with check (
    bucket_id = 'client-photos'
    and ((storage.foldername(name))[1])::uuid in (select public.user_org_ids())
  );

create policy "staff delete client photos" on storage.objects
  for delete using (
    bucket_id = 'client-photos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "staff read skin analyses" on storage.objects
  for select using (
    bucket_id = 'skin-analyses'
    and ((storage.foldername(name))[1])::uuid in (select public.user_org_ids())
  );

create policy "staff insert skin analyses" on storage.objects
  for insert with check (
    bucket_id = 'skin-analyses'
    and ((storage.foldername(name))[1])::uuid in (select public.user_org_ids())
  );

create policy "staff read consents" on storage.objects
  for select using (
    bucket_id = 'consents'
    and ((storage.foldername(name))[1])::uuid in (select public.user_org_ids())
  );

create policy "staff insert consents" on storage.objects
  for insert with check (
    bucket_id = 'consents'
    and ((storage.foldername(name))[1])::uuid in (select public.user_org_ids())
  );
