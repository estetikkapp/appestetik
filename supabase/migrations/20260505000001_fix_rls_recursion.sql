-- Fix: cambiar user_org_ids y user_is_org_admin a SECURITY DEFINER
-- para evitar recursion infinita en las RLS policies.
--
-- Las funciones se llamaban desde policies de memberships (entre otras).
-- Con security invoker, el query interno gatillaba las mismas policies →
-- stack depth limit exceeded. Con security definer corren con permisos
-- del owner (postgres) y bypassean RLS, rompiendo el ciclo.

create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.memberships
  where user_id = auth.uid() and active = true;
$$;

create or replace function public.user_is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and organization_id = org_id
      and role in ('owner', 'admin')
      and active = true
  );
$$;
