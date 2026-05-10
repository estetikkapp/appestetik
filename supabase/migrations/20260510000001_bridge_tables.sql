-- Migration: bridge tables for local WhatsApp agent
--
-- Arquitectura: cada clínica corre un agente Electron en su PC con whatsapp-web.js
-- + Chrome real via Puppeteer. El agente NO usa Baileys (que Meta bloquea) — usa
-- el WhatsApp Web oficial que se baja de servers de Meta. La IP residencial de
-- la clínica + el TLS fingerprint de Chrome real hacen que Meta no detecte abuse.
--
-- Comunicación: el agente hace HTTP polling cada 3s a /api/bridge/poll. Server
-- enqueues comandos (recordatorios, etc.) en bridge_commands. Bridge ejecuta,
-- reporta resultado, server marca como sent/failed.

-- Permitir 'local_bridge' como provider válido de WhatsApp
alter table public.organizations
  drop constraint if exists organizations_whatsapp_provider_check;
alter table public.organizations
  add constraint organizations_whatsapp_provider_check
  check (whatsapp_provider in ('evolution', 'cloud_api', 'local_bridge'));

-- ==========================================
-- bridge_tokens: 1 token por PC (una org puede tener varios)
-- ==========================================
-- El plaintext del token se muestra UNA SOLA VEZ al crear. Solo guardamos hash
-- sha256. La owner pega el plaintext en el instalador del agente.
create table public.bridge_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'PC sin nombre',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create index bridge_tokens_org_idx on public.bridge_tokens (organization_id)
  where revoked_at is null;

-- ==========================================
-- bridge_state: estado actual de cada bridge
-- ==========================================
-- 1 row por bridge_token activo. Status va cambiando:
--   starting → qr_pending → connecting → ready
--   (o disconnected si pierde conexión con WhatsApp)
create table public.bridge_state (
  bridge_token_id uuid primary key references public.bridge_tokens(id) on delete cascade,
  status text not null default 'starting',
  phone_e164 text,
  qr_base64 text,
  qr_updated_at timestamptz,
  last_heartbeat_at timestamptz default now(),
  agent_version text,
  agent_os text,
  updated_at timestamptz not null default now()
);

alter table public.bridge_state
  drop constraint if exists bridge_state_status_check;
alter table public.bridge_state
  add constraint bridge_state_status_check
  check (status in ('starting', 'qr_pending', 'connecting', 'ready', 'disconnected'));

create index bridge_state_status_idx on public.bridge_state (status);
create index bridge_state_heartbeat_idx on public.bridge_state (last_heartbeat_at);

-- ==========================================
-- bridge_commands: cola de mensajes a enviar
-- ==========================================
-- El cron de recordatorios u otros flows enqueuean acá. El bridge polls y procesa.
-- TTL de 24h: si el bridge está offline más tiempo, los mensajes expiran (no querés
-- mandar un "recordatorio de mañana" 3 días después).
create table public.bridge_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bridge_token_id uuid references public.bridge_tokens(id) on delete set null,
  action text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.bridge_commands
  drop constraint if exists bridge_commands_status_check;
alter table public.bridge_commands
  add constraint bridge_commands_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'expired'));

alter table public.bridge_commands
  drop constraint if exists bridge_commands_action_check;
alter table public.bridge_commands
  add constraint bridge_commands_action_check
  check (action in ('send_text', 'send_media'));

-- Índice principal: por org + status para que el polling sea rápido
create index bridge_commands_pending_idx
  on public.bridge_commands (organization_id, created_at)
  where status = 'pending';

-- Limpieza: marcar como expirados al consultar (no auto-cron, manual)
create index bridge_commands_expires_idx on public.bridge_commands (expires_at)
  where status = 'pending';

-- ==========================================
-- RLS
-- ==========================================
alter table public.bridge_tokens enable row level security;
alter table public.bridge_state enable row level security;
alter table public.bridge_commands enable row level security;

-- Tokens: solo owner/admin de la org puede gestionar
create policy "admin manage bridge tokens" on public.bridge_tokens
  for all using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin') and active = true
    )
  );

-- State: cualquier miembro activo de la org puede ver
create policy "members see bridge state" on public.bridge_state
  for select using (
    bridge_token_id in (
      select id from public.bridge_tokens
      where organization_id in (select public.user_org_ids())
    )
  );

-- Commands: solo service_role (admin client) maneja
-- No policies = denied for anon/authenticated. Service role bypassa RLS.

comment on table public.bridge_tokens is
  'Tokens de auth para appestetika-bridge (whatsapp-web.js local agents).';
comment on table public.bridge_state is
  'Estado realtime de cada bridge: QR pendiente, teléfono conectado, heartbeats.';
comment on table public.bridge_commands is
  'Cola de comandos a enviar via bridge (recordatorios, mensajes proactivos).';
