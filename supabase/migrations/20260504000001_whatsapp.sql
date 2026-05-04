-- Migration: WhatsApp integration
-- Sprint 3: recordatorios automáticos via WhatsApp (Evolution API)

-- Estado de la conexión WhatsApp por org
alter table public.organizations
  add column if not exists whatsapp_status text not null default 'disconnected'
    check (whatsapp_status in ('disconnected', 'connecting', 'connected')),
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_connected_at timestamptz;

-- Log de recordatorios enviados (para auditoría y deduplicación extra)
create table public.whatsapp_reminder_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  phone_e164 text not null,
  message text not null,
  sent_at timestamptz not null default now(),
  error text
);

create index whatsapp_reminder_log_appointment_idx
  on public.whatsapp_reminder_log (appointment_id);
create index whatsapp_reminder_log_org_sent_idx
  on public.whatsapp_reminder_log (organization_id, sent_at desc);

alter table public.whatsapp_reminder_log enable row level security;

create policy "owner admin see reminder log" on public.whatsapp_reminder_log
  for select using (public.user_is_org_admin(organization_id));
