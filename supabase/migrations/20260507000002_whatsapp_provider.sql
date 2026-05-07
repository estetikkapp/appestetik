-- WhatsApp provider per org: Evolution (Baileys, requiere VPS sin IP bloqueada) o
-- Cloud API oficial de Meta (requiere cuenta Meta Business + número WhatsApp Business)
--
-- Por qué este cambio: Meta bloquea registro de nuevos dispositivos desde IPs de
-- datacenter via Baileys (failure 405 desde múltiples regiones). Cloud API
-- oficial funciona desde cualquier IP porque es el canal sancionado.

alter table public.organizations
  add column if not exists whatsapp_provider text default 'evolution',
  add column if not exists whatsapp_cloud_config jsonb;

-- Las orgs ya creadas siguen en 'evolution' por compatibilidad. Pueden cambiar a
-- 'cloud_api' desde Configuración cuando carguen sus credenciales Meta.
alter table public.organizations
  drop constraint if exists organizations_whatsapp_provider_check;
alter table public.organizations
  add constraint organizations_whatsapp_provider_check
  check (whatsapp_provider in ('evolution', 'cloud_api'));

-- Índice para queries por provider
create index if not exists organizations_whatsapp_provider_idx
  on public.organizations (whatsapp_provider)
  where whatsapp_status = 'connected';

comment on column public.organizations.whatsapp_provider is
  'evolution = Baileys via VPS Evolution API. cloud_api = Meta WhatsApp Cloud API oficial.';
comment on column public.organizations.whatsapp_cloud_config is
  'JSON: {phone_number_id, business_account_id, access_token, verify_token}. Solo si whatsapp_provider=cloud_api.';
