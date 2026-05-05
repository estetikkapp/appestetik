-- Migration: notifications in-app + audit_log
-- Adapt UTN-FRT model: notifications garantizan delivery cuando el email
-- (o WhatsApp) falla. Audit log registra toda acción significativa.

-- ==========================================
-- Notifications in-app
-- ==========================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'appointment_cancelled', 'appointment_created', 'closure_applied', etc.
  title text not null,
  body text,
  link text, -- href interno opcional para clickear y profundizar
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_org_idx
  on public.notifications (organization_id, created_at desc);

alter table public.notifications enable row level security;

-- Cada user ve sus propias notificaciones
create policy "users see own notifications" on public.notifications
  for select using (user_id = auth.uid());

-- Cada user puede marcar como leídas las suyas
create policy "users update own notifications" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service role inserta (los Server Actions usan admin client)
-- Owner/admin puede borrar (cleanup)
create policy "owner admin delete notifications" on public.notifications
  for delete using (public.user_is_org_admin(organization_id));

-- Habilitar realtime para esta tabla
alter publication supabase_realtime add table public.notifications;

-- ==========================================
-- Audit log
-- ==========================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text, -- 'sistema', 'cron', etc. cuando no hay auth
  action text not null, -- 'appointment.cancel', 'closure.apply', 'service.delete', etc.
  entity_type text not null, -- 'appointment', 'closure', 'service', etc.
  entity_id uuid,
  payload jsonb default '{}'::jsonb, -- detalles relevantes
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx
  on public.audit_log (organization_id, created_at desc);
create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_user_id) where actor_user_id is not null;

alter table public.audit_log enable row level security;

-- Solo owner/admin ve audit log
create policy "owner admin see audit log" on public.audit_log
  for select using (public.user_is_org_admin(organization_id));

-- Insert solo via service role (Server Actions)
-- No update/delete: audit log es append-only
