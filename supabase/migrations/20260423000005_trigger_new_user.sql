-- Migration: trigger on_auth_user_created
-- Sprint 1: crea org + membership owner automáticamente en signup,
-- o respeta invitación si hay token válido

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
begin
  -- Si el signup viene de una invitación, intentar resolverla
  if new.raw_user_meta_data->>'invitation_token' is not null then
    select i.id, i.organization_id, i.role, i.invited_by
    into pending_invitation_id, invitation_org_id, invitation_role, invitation_inviter
    from public.invitations i
    where i.token = new.raw_user_meta_data->>'invitation_token'
      and i.accepted_at is null
      and i.expires_at > now()
      and lower(i.email) = lower(new.email);

    if pending_invitation_id is not null then
      insert into public.memberships (user_id, organization_id, role, invitation_accepted_at, invited_by)
      values (new.id, invitation_org_id, invitation_role, now(), invitation_inviter);

      update public.invitations set accepted_at = now() where id = pending_invitation_id;
      return new;
    end if;
  end if;

  -- Signup normal: crear organización nueva + membership owner
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'organization_name', 'Mi centro'))
  returning id into new_org_id;

  insert into public.memberships (user_id, organization_id, role, invitation_accepted_at)
  values (new.id, new_org_id, 'owner', now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
