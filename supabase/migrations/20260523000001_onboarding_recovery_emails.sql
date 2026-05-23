-- Tracking de los mails de recuperación de onboarding enviados.
--
-- Para que el cron no spamee al mismo user con el mismo email kind.
-- Cada (user_id, email_kind) es único — si ya hay row, no se manda.
--
-- email_kind valores:
--   'recovery_1' → 24h post-signup
--   'recovery_2' → 72h (3 días)
--   'recovery_3' → 168h (7 días, último intento)

create table if not exists public.onboarding_recovery_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_kind text not null check (email_kind in ('recovery_1', 'recovery_2', 'recovery_3')),
  email_to text not null,
  sent_at timestamptz not null default now(),
  -- Si el mail falló en Resend, registramos la razón para debugging
  -- sin re-intentar (mejor avisar manualmente al user que reintentar mil veces)
  resend_message_id text,
  failed_reason text,
  unique (user_id, email_kind)
);

create index if not exists onboarding_recovery_emails_user_idx
  on public.onboarding_recovery_emails (user_id, email_kind);

create index if not exists onboarding_recovery_emails_sent_at_idx
  on public.onboarding_recovery_emails (sent_at desc);

alter table public.onboarding_recovery_emails enable row level security;

-- Nadie lee esta tabla desde el cliente — solo el cron via service_role.
-- No agregamos policies de SELECT así queda bloqueada por default a usuarios.

comment on table public.onboarding_recovery_emails is
  'Tracking de mails de recuperación de onboarding. 1 fila por (user_id, email_kind). El cron diario /api/cron/onboarding-recovery escribe acá tras enviar.';
