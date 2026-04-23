-- Seed data para desarrollo local.
-- Se aplica después de las migraciones con `supabase db reset`.
-- NO correr en producción. Este seed asume que no hay usuarios creados todavía.
--
-- Uso sugerido:
--   1. supabase db reset                             → aplica migraciones + corre este seed
--   2. Supabase Studio → Authentication → Add user  → crear un user de prueba
--   3. El trigger on_auth_user_created crea automáticamente la org + owner membership
--   4. Correr el bloque `seed_demo_data()` abajo pasando el org_id que generó el trigger
--
-- Ejemplo post-signup:
--   select public.seed_demo_data('<org_id>');

create or replace function public.seed_demo_data(target_org_id uuid)
returns void
language plpgsql
as $$
begin
  -- Services
  insert into public.services (organization_id, name, category, duration_minutes, price_ars, requires_consent)
  values
    (target_org_id, 'Limpieza facial profunda', 'facial', 60, 18000, false),
    (target_org_id, 'Depilación láser axilas', 'depilacion', 30, 12000, true),
    (target_org_id, 'Depilación láser piernas completas', 'depilacion', 60, 35000, true),
    (target_org_id, 'Masaje descontracturante', 'masajes', 60, 15000, false),
    (target_org_id, 'Manicura + esmalte semi', 'unias', 45, 9000, false),
    (target_org_id, 'Radiofrecuencia facial', 'facial', 45, 22000, false)
  on conflict do nothing;

  -- Resources
  insert into public.resources (organization_id, name, type)
  values
    (target_org_id, 'Cabina 1', 'cabin'),
    (target_org_id, 'Cabina 2', 'cabin'),
    (target_org_id, 'Láser Alma Soprano', 'laser'),
    (target_org_id, 'Radiofrecuencia', 'radiofrequency')
  on conflict do nothing;

  -- Clientas demo
  insert into public.clients (organization_id, full_name, phone_e164, email, dni)
  values
    (target_org_id, 'María García', '+5491112345001', 'maria@ejemplo.com', '30123456'),
    (target_org_id, 'Julieta Fernández', '+5491112345002', 'julieta@ejemplo.com', '32456789'),
    (target_org_id, 'Sofía López', '+5491112345003', null, '28987654'),
    (target_org_id, 'Valentina Ríos', '+5491112345004', 'valen@ejemplo.com', null),
    (target_org_id, 'Camila Suárez', null, 'cami@ejemplo.com', '35234567')
  on conflict do nothing;

  raise notice 'Seed demo completado para org %', target_org_id;
end;
$$;

comment on function public.seed_demo_data(uuid) is
  'Seed de data demo para una org. Correr manualmente post-signup con select public.seed_demo_data(org_id);';
