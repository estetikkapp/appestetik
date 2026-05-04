'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/utils/db-errors';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

export async function createService(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '').trim() || null;
  const durationMinutes = Number(formData.get('duration_minutes') ?? 0);
  const bufferMinutes = Number(formData.get('buffer_minutes') ?? 0);
  const priceArs = Number(formData.get('price_ars') ?? 0);
  const requiresConsent = formData.get('requires_consent') === 'on';

  if (!name) redirect('/servicios?error=El+nombre+es+obligatorio');
  if (durationMinutes < 1) redirect('/servicios?error=Duraci%C3%B3n+inv%C3%A1lida');
  if (priceArs < 0) redirect('/servicios?error=Precio+inv%C3%A1lido');

  const supabase = createClient();
  const { error } = await supabase.from('services').insert({
    organization_id: orgId,
    name,
    category,
    description,
    duration_minutes: durationMinutes,
    buffer_minutes: bufferMinutes,
    price_ars: priceArs,
    requires_consent: requiresConsent,
  });

  if (error) redirect(`/servicios?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/servicios');
  redirect('/servicios?ok=creado');
}

export async function updateService(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/servicios?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('services')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      category: String(formData.get('category') ?? '').trim() || null,
      description: String(formData.get('description') ?? '').trim() || null,
      duration_minutes: Number(formData.get('duration_minutes') ?? 0),
      buffer_minutes: Number(formData.get('buffer_minutes') ?? 0),
      price_ars: Number(formData.get('price_ars') ?? 0),
      requires_consent: formData.get('requires_consent') === 'on',
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/servicios?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/servicios');
  redirect('/servicios?ok=actualizado');
}

export async function toggleServiceActive(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const supabase = createClient();
  const { error } = await supabase
    .from('services')
    .update({ active: !active })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/servicios?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/servicios');
  redirect('/servicios');
}

export async function deleteService(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/servicios?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/servicios?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/servicios');
  redirect('/servicios?ok=eliminado');
}
