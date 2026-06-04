-- Función de listado de usuarios SaaS para el panel admin (/admin/usuarios).
--
-- Devuelve UNA fila por usuario con datos de auth.users + su membership y
-- organización. Cubre el caso multi-membresía: si un usuario es miembro de
-- varias orgs, agrega una fila por cada una.
--
-- Se invoca SOLO con service-role desde el server, después de validar
-- super-admin. Revocada del rol authenticated/anon.

create or replace function public.platform_users()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  membership_id uuid,
  org_id uuid,
  org_name text,
  org_slug text,
  role text,
  display_name text,
  membership_active boolean,
  membership_created_at timestamptz,
  invitation_accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.email::text,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    m.id as membership_id,
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    m.role,
    m.display_name,
    m.active as membership_active,
    m.created_at as membership_created_at,
    m.invitation_accepted_at
  from auth.users u
  left join public.memberships m on m.user_id = u.id
  left join public.organizations o on o.id = m.organization_id
  order by u.created_at desc, m.created_at desc;
$$;

-- Solo service_role debe poder ejecutar.
revoke all on function public.platform_users() from public, anon, authenticated;
