-- ============================================================================
-- Sistema de planes y suscripciones
-- ============================================================================
--
-- Reemplaza el placeholder de subscription_tier por un modelo real:
--
--   - Definiciones de planes (precios, límites, features) viven en código
--     (src/lib/plans/definitions.ts) — cambian poco, queremos PR review.
--
--   - Estado por org vive en plan_subscriptions: qué plan tiene, fechas del
--     período, status (trialing | active | past_due | suspended | trial_expired
--     | cancelled | expired), info de Mercado Pago.
--
--   - Contadores de uso de IA (que se resetean por período) viven en
--     ai_usage_counters, separados de los outputs históricos (skin_analyses,
--     treatment_protocols) que ya existen.
--
--   - Add-ons comprados (packs IA extra que se suman al período actual) en
--     ai_addon_purchases.
--
--   - Facturas que el SaaS le cobra a las clínicas en saas_invoices
--     (renombrada deliberadamente — `invoices` ya existe para clínica→paciente).
--
--   - Historial de cambios de plan en plan_change_events (audit + scheduled
--     changes para downgrades que se aplican al fin del período).
--
-- Backfill: las 6 orgs existentes a fecha de la migration quedan
-- legacy_grandfathered=true con una sub Gabinete 'active' hasta 9999-12-31.
-- El factory de feature flags interpreta legacy_grandfathered como override
-- total: ve TODAS las features sin importar el plan_id (decisión del owner
-- — son sus primeras usuarias / equipo de pruebas).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 1: limpiar columnas placeholder de organizations
-- ────────────────────────────────────────────────────────────────────────────
-- subscription_tier y trial_ends_at eran defaults sin enforcement. La nueva
-- fuente de verdad es plan_subscriptions. Cuts limpios — los 2 lectores
-- existentes se actualizan en esta misma PR.

alter table public.organizations drop column if exists subscription_tier;
alter table public.organizations drop column if exists trial_ends_at;

alter table public.organizations
  add column if not exists legacy_grandfathered boolean not null default false;

comment on column public.organizations.legacy_grandfathered is
  'TRUE = org pre-existente al sistema de planes. Override que desbloquea todas las features sin importar plan_id. NO se asigna a orgs nuevas.';


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 2: plan_subscriptions — estado de la suscripción por org
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- plan_id en texto libre (no FK ni CHECK) para soportar 'centro' futuro sin
  -- migration extra. El código valida contra src/lib/plans/definitions.ts.
  plan_id text not null,

  -- 'monthly' | 'yearly'. Yearly = pago único upfront, sin auto-renew.
  -- Monthly = MP preapproval con débito automático.
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),

  -- Estados:
  --   trialing       — dentro de los 30 días gratis del plan elegido
  --   active         — pagando OK
  --   past_due       — último pago falló, en gracia (7 días, retry policy)
  --   suspended      — sin pago tras gracia, read-only hasta resolver
  --   trial_expired  — trial venció sin método de pago, read-only +15 días
  --   cancelled      — canceló pero el período pagado sigue vigente
  --   expired        — terminó el período pagado, sin renovar. Archivar.
  status text not null check (status in (
    'trialing', 'active', 'past_due', 'suspended',
    'trial_expired', 'cancelled', 'expired'
  )),

  trial_started_at timestamptz,
  trial_ends_at timestamptz,

  current_period_started_at timestamptz not null,
  current_period_ends_at timestamptz not null,

  -- Si TRUE, cuando termine el período actual se pasa a 'expired'.
  -- Lo setea el endpoint de cancel.
  cancel_at_period_end boolean not null default false,

  -- Mercado Pago — solo para 'monthly' (preapproval para débito recurrente).
  -- En 'yearly' queda NULL (pago único via Checkout Pro).
  mp_preapproval_id text,

  -- Identificador que NOSOTROS generamos y pasamos a MP al crear el cobro.
  -- Los webhooks de MP traen este valor para matchear con la sub.
  mp_external_reference text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo UNA sub "viva" por org. Las canceladas/expiradas quedan en tabla para
-- historial (cuando una clínica vuelve después de irse, queremos saber qué
-- tenía antes).
create unique index if not exists plan_subscriptions_org_active_idx
  on public.plan_subscriptions (organization_id)
  where status in ('trialing', 'active', 'past_due', 'suspended', 'trial_expired');

create index if not exists plan_subscriptions_period_end_idx
  on public.plan_subscriptions (current_period_ends_at)
  where status in ('trialing', 'active', 'past_due');

create index if not exists plan_subscriptions_mp_preapproval_idx
  on public.plan_subscriptions (mp_preapproval_id)
  where mp_preapproval_id is not null;

create trigger set_updated_at_plan_subscriptions
  before update on public.plan_subscriptions
  for each row execute function public.tg_set_updated_at();

alter table public.plan_subscriptions enable row level security;

-- Lectura: cualquier miembro de la org ve su sub (necesario para mostrar
-- estado en la UI). Insert/update: solo system (service_role) — los cambios
-- ocurren via server actions con admin client tras validar permisos.
create policy "members see own org subscription" on public.plan_subscriptions
  for select using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 3: ai_usage_counters — contador mensual por período
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por (sub, período). Se crea/upsert atómicamente en la primera
-- llamada a IA del período. Se resetea automáticamente cuando avanza el
-- período (nueva fila para el período nuevo).

create table if not exists public.ai_usage_counters (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.plan_subscriptions(id) on delete cascade,

  -- Bordes del período (copiados de plan_subscriptions al momento del primer
  -- uso). No usamos FK al período porque queremos historial.
  period_started_at timestamptz not null,
  period_ends_at timestamptz not null,

  -- Consumo
  skin_diagnosis_used int not null default 0 check (skin_diagnosis_used >= 0),
  protocol_generator_used int not null default 0 check (protocol_generator_used >= 0),

  -- Cuota EXTRA del período (sumatoria de add-ons comprados). Se compara
  -- contra (plan_limit + bonus_quota) para decidir si bloquear el call.
  skin_diagnosis_bonus_quota int not null default 0 check (skin_diagnosis_bonus_quota >= 0),
  protocol_generator_bonus_quota int not null default 0 check (protocol_generator_bonus_quota >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (subscription_id, period_started_at)
);

create index if not exists ai_usage_counters_sub_idx
  on public.ai_usage_counters (subscription_id, period_ends_at desc);

create trigger set_updated_at_ai_usage_counters
  before update on public.ai_usage_counters
  for each row execute function public.tg_set_updated_at();

alter table public.ai_usage_counters enable row level security;

create policy "members see own org ai usage" on public.ai_usage_counters
  for select using (
    subscription_id in (
      select id from public.plan_subscriptions
      where organization_id in (
        select organization_id from public.memberships
        where user_id = auth.uid() and active = true
      )
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 4: ai_addon_purchases — compras de cuota extra
-- ────────────────────────────────────────────────────────────────────────────
-- Cada compra de un Pack IA extra se guarda acá. Al confirmarse el pago
-- (webhook MP), se incrementa el bonus_quota correspondiente en
-- ai_usage_counters del período en curso.

create table if not exists public.ai_addon_purchases (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.plan_subscriptions(id) on delete restrict,

  -- IDs de definitions.ts: 'skin_diagnosis_50' | 'protocol_25'
  addon_type text not null,
  quantity_added int not null check (quantity_added > 0),

  amount_ars numeric(10,2) not null check (amount_ars >= 0),

  -- 'pending' = checkout creado, esperando webhook
  -- 'paid'    = webhook confirmó pago, bonus_quota ya aplicada
  -- 'failed'  = MP devolvió rechazo o expiró
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),

  -- MP refs
  mp_payment_id text,
  mp_external_reference text unique,

  -- Si paid: a qué período se aplicó (para auditoría si reseteo el counter).
  applied_to_period_start timestamptz,
  applied_to_period_end timestamptz,

  paid_at timestamptz,
  failed_at timestamptz,
  failed_reason text,

  created_at timestamptz not null default now()
);

create index if not exists ai_addon_purchases_sub_idx
  on public.ai_addon_purchases (subscription_id, created_at desc);

create index if not exists ai_addon_purchases_pending_idx
  on public.ai_addon_purchases (mp_external_reference)
  where status = 'pending';

alter table public.ai_addon_purchases enable row level security;

create policy "members see own org addons" on public.ai_addon_purchases
  for select using (
    subscription_id in (
      select id from public.plan_subscriptions
      where organization_id in (
        select organization_id from public.memberships
        where user_id = auth.uid() and active = true
      )
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 5: saas_invoices — facturas que el SaaS cobra a las clínicas
-- ────────────────────────────────────────────────────────────────────────────
-- NO CONFUNDIR con la tabla `invoices` (que es clínica→paciente). Acá se
-- guarda cada cobro mensual/anual + intentos fallidos para retry.
-- El nombre tiene prefijo `saas_` justamente para no chocar visualmente.

create table if not exists public.saas_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.plan_subscriptions(id) on delete restrict,

  amount_ars numeric(10,2) not null check (amount_ars >= 0),

  billing_period_start timestamptz not null,
  billing_period_end timestamptz not null,

  -- 'subscription' = cobro normal del ciclo
  -- 'addon'        = compra de pack IA extra
  -- 'upgrade_diff' = diferencia cobrada al hacer upgrade mid-period
  invoice_kind text not null default 'subscription'
    check (invoice_kind in ('subscription', 'addon', 'upgrade_diff')),

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),

  mp_payment_id text,
  mp_external_reference text unique,

  paid_at timestamptz,
  failed_at timestamptz,
  failed_reason text,

  -- Retry policy: 3 intentos en 7 días para 'subscription' que fallaron.
  attempts int not null default 0 check (attempts >= 0),
  next_retry_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists saas_invoices_sub_idx
  on public.saas_invoices (subscription_id, created_at desc);

create index if not exists saas_invoices_retry_idx
  on public.saas_invoices (next_retry_at)
  where status = 'failed' and next_retry_at is not null;

alter table public.saas_invoices enable row level security;

create policy "members see own org saas invoices" on public.saas_invoices
  for select using (
    subscription_id in (
      select id from public.plan_subscriptions
      where organization_id in (
        select organization_id from public.memberships
        where user_id = auth.uid() and active = true
      )
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 6: plan_change_events — historial + cambios diferidos
-- ────────────────────────────────────────────────────────────────────────────
-- Cada upgrade/downgrade/change-of-cycle genera una fila. Sirve para:
--   1) audit (quién cambió qué cuándo y por qué)
--   2) cambios diferidos: downgrade Equipo → Gabinete se aplica al fin del
--      período (no inmediato), entonces dejamos la fila con applied_at=null
--      y un cron diario la procesa cuando llega effective_at.

create table if not exists public.plan_change_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.plan_subscriptions(id) on delete cascade,

  from_plan text not null,
  to_plan text not null,
  from_billing_cycle text,
  to_billing_cycle text,

  -- Cuándo se debe aplicar (now para upgrades, period_ends_at para downgrades)
  effective_at timestamptz not null,

  -- Cuándo se aplicó efectivamente. NULL = pendiente.
  applied_at timestamptz,

  -- Para upgrades: cuánto cobramos de diferencia (flat según decisión del owner)
  charge_amount_ars numeric(10,2),
  saas_invoice_id uuid references public.saas_invoices(id) on delete set null,

  triggered_by_user_id uuid references auth.users(id) on delete set null,
  reason text,

  created_at timestamptz not null default now()
);

create index if not exists plan_change_events_sub_idx
  on public.plan_change_events (subscription_id, created_at desc);

create index if not exists plan_change_events_pending_idx
  on public.plan_change_events (effective_at)
  where applied_at is null;

alter table public.plan_change_events enable row level security;

create policy "members see own org plan changes" on public.plan_change_events
  for select using (
    subscription_id in (
      select id from public.plan_subscriptions
      where organization_id in (
        select organization_id from public.memberships
        where user_id = auth.uid() and active = true
      )
    )
  );


-- ────────────────────────────────────────────────────────────────────────────
-- Paso 7: backfill — orgs existentes → Gabinete grandfathered
-- ────────────────────────────────────────────────────────────────────────────
-- Crea una sub Gabinete activa hasta 9999-12-31 para cada org existente,
-- y las marca legacy_grandfathered. El factory de features ve este flag
-- y desbloquea todo sin importar plan_id (decisión del owner — son las
-- pruebas internas / amigos beta).

update public.organizations set legacy_grandfathered = true
where created_at < now();

insert into public.plan_subscriptions (
  organization_id,
  plan_id,
  billing_cycle,
  status,
  current_period_started_at,
  current_period_ends_at,
  mp_external_reference
)
select
  o.id,
  'gabinete',
  'monthly',
  'active',
  now(),
  '9999-12-31 23:59:59+00'::timestamptz,
  'legacy_' || o.id::text
from public.organizations o
where not exists (
  select 1 from public.plan_subscriptions ps where ps.organization_id = o.id
);


-- ────────────────────────────────────────────────────────────────────────────
-- Comments para documentar intent en pg_dump y exploradores SQL
-- ────────────────────────────────────────────────────────────────────────────
comment on table public.plan_subscriptions is
  'Suscripción activa por org. Fuente de verdad del plan, período y status. Las definiciones de planes (precio, límites, features) están en src/lib/plans/definitions.ts.';
comment on table public.ai_usage_counters is
  'Contador de uso de IA por período de suscripción. Una fila por (sub, periodo). Se resetea al avanzar el período.';
comment on table public.ai_addon_purchases is
  'Compras de Packs IA extra que suman a la cuota del período actual. No prorratea, no se acumula al siguiente período.';
comment on table public.saas_invoices is
  'Facturas que appestetika cobra a las clínicas (subscription / addon / upgrade_diff). NO confundir con `invoices` (clínica → paciente).';
comment on table public.plan_change_events is
  'Audit + cola de cambios diferidos. Downgrades se aplican al fin del período con un cron que procesa applied_at IS NULL.';
