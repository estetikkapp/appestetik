-- Migration: storage buckets
-- Sprint 1: bucket para logos de organizaciones (privado, signed URLs)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  false,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Policies: owner/admin pueden read/write los archivos de su org
-- Path convention: {organization_id}/logo.{ext}

create policy "owner admin read logos" on storage.objects
  for select using (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "owner admin insert logos" on storage.objects
  for insert with check (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "owner admin update logos" on storage.objects
  for update using (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "owner admin delete logos" on storage.objects
  for delete using (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );
