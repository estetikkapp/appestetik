-- Función de stats para el panel de plataforma (/admin) — back office founders.
--
-- Devuelve UNA fila por organización con todos los agregados pre-calculados,
-- evitando el N+1 de hacer una query de count por org desde la app.
--
-- Se invoca SOLO con el service-role key (admin client) desde el server,
-- después de validar super-admin. No tiene SECURITY DEFINER porque el
-- service-role ya bypassa RLS — no queremos exponerla a roles anon/authenticated.
--
-- Solo agrega counts (sin PII de clientas).

create or replace function public.platform_org_stats()
returns table (
  org_id uuid,
  name text,
  slug text,
  created_at timestamptz,
  onboarded_at timestamptz,
  plan_id text,
  sub_status text,
  trial_ends_at timestamptz,
  whatsapp_status text,
  whatsapp_provider text,
  has_mp boolean,
  afip_provider text,
  services_count bigint,
  clients_count bigint,
  active_clients_count bigint,
  appointments_count bigint,
  appointments_last_30d bigint,
  staff_count bigint,
  last_activity_at timestamptz
)
language sql
stable
as $$
  select
    o.id as org_id,
    o.name,
    o.slug,
    o.created_at,
    o.onboarded_at,
    ps.plan_id,
    ps.status as sub_status,
    ps.trial_ends_at,
    o.whatsapp_status,
    o.whatsapp_provider,
    (o.mp_config is not null) as has_mp,
    o.afip_provider,
    coalesce((select count(*) from public.services s
      where s.organization_id = o.id and s.active = true), 0) as services_count,
    coalesce((select count(*) from public.clients c
      where c.organization_id = o.id), 0) as clients_count,
    coalesce((select count(*) from public.clients c
      where c.organization_id = o.id
        and c.last_visit_at > now() - interval '90 days'), 0) as active_clients_count,
    coalesce((select count(*) from public.appointments a
      where a.organization_id = o.id), 0) as appointments_count,
    coalesce((select count(*) from public.appointments a
      where a.organization_id = o.id
        and a.created_at > now() - interval '30 days'), 0) as appointments_last_30d,
    coalesce((select count(*) from public.memberships m
      where m.organization_id = o.id and m.active = true), 0) as staff_count,
    greatest(
      o.created_at,
      (select max(a.created_at) from public.appointments a where a.organization_id = o.id),
      (select max(c.created_at) from public.clients c where c.organization_id = o.id)
    ) as last_activity_at
  from public.organizations o
  left join public.plan_subscriptions ps on ps.organization_id = o.id
  order by o.created_at desc;
$$;

-- Revocar acceso a roles públicos — solo service_role la usa.
revoke all on function public.platform_org_stats() from public, anon, authenticated;
