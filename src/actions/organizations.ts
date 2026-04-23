'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isValidCuit, normalizeCuit } from '@/lib/validators/cuit';
import { isValidSlug } from '@/lib/validators/slug';
import type { TaxCondition } from '@/types/app';

const ACTIVE_ORG_COOKIE = 'active_org';

async function getActiveOrgId(): Promise<string | null> {
  const store = cookies();
  return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

async function requireActiveOrgAsOwner(): Promise<
  { ok: true; orgId: string } | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No hay sesión activa' };

  const orgId = await getActiveOrgId();
  if (!orgId) return { ok: false, error: 'No hay organización activa' };

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .single();

  if (!membership || membership.role !== 'owner') {
    return { ok: false, error: 'Solo el owner puede configurar la organización' };
  }

  return { ok: true, orgId };
}

export async function updateOrganizationFiscal(formData: FormData): Promise<void> {
  const check = await requireActiveOrgAsOwner();
  if (!check.ok) redirect(`/auth/login?error=${encodeURIComponent(check.error)}`);

  const name = String(formData.get('name') ?? '').trim();
  const legalName = String(formData.get('legal_name') ?? '').trim() || null;
  const cuit = String(formData.get('cuit') ?? '').trim();
  const taxCondition = String(formData.get('tax_condition') ?? '') as TaxCondition;
  const displayName = String(formData.get('display_name') ?? '').trim() || null;

  if (!name) redirect('/onboarding?error=El+nombre+es+obligatorio');
  if (cuit && !isValidCuit(cuit)) redirect('/onboarding?error=CUIT+inv%C3%A1lido');
  if (!['monotributo', 'responsable_inscripto', 'exento'].includes(taxCondition)) {
    redirect('/onboarding?error=Condici%C3%B3n+IVA+inv%C3%A1lida');
  }

  const supabase = createClient();
  const { error: orgError } = await supabase
    .from('organizations')
    .update({
      name,
      legal_name: legalName,
      cuit: cuit ? normalizeCuit(cuit) : null,
      tax_condition: taxCondition,
    })
    .eq('id', check.orgId);

  if (orgError) redirect(`/onboarding?error=${encodeURIComponent(orgError.message)}`);

  // Actualizar display_name del membership del user actual
  if (displayName) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('memberships')
        .update({ display_name: displayName })
        .eq('user_id', user.id)
        .eq('organization_id', check.orgId);
    }
  }

  redirect('/onboarding/horarios');
}

export async function updateBusinessHours(formData: FormData): Promise<void> {
  const check = await requireActiveOrgAsOwner();
  if (!check.ok) redirect(`/auth/login?error=${encodeURIComponent(check.error)}`);

  const supabase = createClient();
  const rows = Array.from({ length: 7 }, (_, day) => ({
    organization_id: check.orgId,
    day_of_week: day,
    active: formData.get(`active_${day}`) === 'on',
    opens_at: (formData.get(`opens_${day}`) as string) || null,
    closes_at: (formData.get(`closes_${day}`) as string) || null,
  }));

  // Borrar previos + insertar nuevos (upsert sobre unique constraint)
  await supabase.from('business_hours').delete().eq('organization_id', check.orgId);
  const { error } = await supabase.from('business_hours').insert(rows);

  if (error) redirect(`/onboarding/horarios?error=${encodeURIComponent(error.message)}`);

  redirect('/onboarding/servicio');
}

export async function createFirstService(formData: FormData): Promise<void> {
  const check = await requireActiveOrgAsOwner();
  if (!check.ok) redirect(`/auth/login?error=${encodeURIComponent(check.error)}`);

  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() || null;
  const durationMinutes = Number(formData.get('duration_minutes') ?? 0);
  const priceArs = Number(formData.get('price_ars') ?? 0);

  if (!name) redirect('/onboarding/servicio?error=El+nombre+es+obligatorio');
  if (durationMinutes < 1)
    redirect('/onboarding/servicio?error=La+duraci%C3%B3n+debe+ser+mayor+a+0');
  if (priceArs < 0) redirect('/onboarding/servicio?error=El+precio+no+puede+ser+negativo');

  const supabase = createClient();
  const { error } = await supabase.from('services').insert({
    organization_id: check.orgId,
    name,
    category,
    duration_minutes: durationMinutes,
    price_ars: priceArs,
  });

  if (error) redirect(`/onboarding/servicio?error=${encodeURIComponent(error.message)}`);

  redirect('/onboarding/presencia');
}

export async function finalizeOnboarding(formData: FormData): Promise<void> {
  const check = await requireActiveOrgAsOwner();
  if (!check.ok) redirect(`/auth/login?error=${encodeURIComponent(check.error)}`);

  const slug = String(formData.get('slug') ?? '').trim();

  if (!isValidSlug(slug)) {
    redirect('/onboarding/presencia?error=URL+p%C3%BAblica+inv%C3%A1lida');
  }

  const supabase = createClient();

  // Verificar slug disponible
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', check.orgId)
    .maybeSingle();

  if (existing) {
    redirect('/onboarding/presencia?error=Esa+URL+ya+est%C3%A1+en+uso');
  }

  const { error } = await supabase
    .from('organizations')
    .update({ slug, onboarded_at: new Date().toISOString() })
    .eq('id', check.orgId);

  if (error) redirect(`/onboarding/presencia?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function checkSlugAvailable(slug: string): Promise<{ available: boolean; reason?: string }> {
  if (!isValidSlug(slug)) {
    return { available: false, reason: 'Formato inválido' };
  }
  const check = await requireActiveOrgAsOwner();
  if (!check.ok) return { available: false, reason: check.error };

  const supabase = createClient();
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', check.orgId)
    .maybeSingle();

  return data ? { available: false, reason: 'En uso' } : { available: true };
}
