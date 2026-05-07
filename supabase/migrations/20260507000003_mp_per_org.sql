-- Mercado Pago per-org: cada clínica carga su propio access token
--
-- Antes: MP_ACCESS_TOKEN era global → todos los pagos iban a la cuenta MP del SaaS.
-- Ahora: cada org guarda su mp_config (access_token, public_key opcional,
-- webhook_secret opcional) en la tabla organizations.
--
-- mp_config shape:
--   {
--     "access_token": "APP_USR-...",      -- requerido para crear preferences
--     "public_key": "APP_USR-...",         -- opcional, futuro checkout-pro embedded
--     "webhook_secret": "abc123..."        -- opcional, para validar firma webhooks
--   }

alter table public.organizations
  add column if not exists mp_config jsonb;

comment on column public.organizations.mp_config is
  'JSON con credenciales Mercado Pago de la org: access_token (requerido), public_key, webhook_secret. Cada clinica usa su propia cuenta MP.';
