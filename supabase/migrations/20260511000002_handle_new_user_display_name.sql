-- Fix: el trigger handle_new_user() guardaba la org y rol del invitado pero
-- ignoraba el full_name del raw_user_meta_data. Resultado: /empleadas
-- mostraba al nuevo miembro sin nombre.
--
-- Solución: leer full_name del metadata y poblar memberships.display_name
-- en AMBOS paths (invitación y signup normal).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_invitation_id uuid;
  invitation_org_id uuid;
  invitation_role text;
  invitation_inviter uuid;
  new_org_id uuid;
  new_display_name text;
begin
  -- Normalizar: trim + tratar '' como NULL
  new_display_name := nullif(trim(new.raw_user_meta_data->>'full_name'), '');

  -- Path invitación
  if new.raw_user_meta_data->>'invitation_token' is not null then
    select i.id, i.organization_id, i.role, i.invited_by
    into pending_invitation_id, invitation_org_id, invitation_role, invitation_inviter
    from public.invitations i
    where i.token = new.raw_user_meta_data->>'invitation_token'
      and i.accepted_at is null
      and i.expires_at > now()
      and lower(i.email) = lower(new.email);

    if pending_invitation_id is not null then
      insert into public.memberships
        (user_id, organization_id, role, display_name, invitation_accepted_at, invited_by)
      values
        (new.id, invitation_org_id, invitation_role, new_display_name, now(), invitation_inviter);

      update public.invitations set accepted_at = now() where id = pending_invitation_id;
      return new;
    end if;
  end if;

  -- Path signup normal: crear org + owner membership
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'organization_name', 'Mi centro'))
  returning id into new_org_id;

  insert into public.memberships
    (user_id, organization_id, role, display_name, invitation_accepted_at)
  values
    (new.id, new_org_id, 'owner', new_display_name, now());

  return new;
end;
$$;

-- Backfill: copiar full_name de raw_user_meta_data a memberships.display_name
-- para todos los memberships existentes que tengan display_name NULL pero el
-- user sí haya guardado un full_name al registrarse.
update public.memberships m
set display_name = nullif(trim(u.raw_user_meta_data->>'full_name'), '')
from auth.users u
where m.user_id = u.id
  and m.display_name is null
  and nullif(trim(u.raw_user_meta_data->>'full_name'), '') is not null;
