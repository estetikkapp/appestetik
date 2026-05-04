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

const PHOTO_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

async function uploadPhotos(
  files: File[],
  orgId: string,
  clientId: string,
  prefix: 'before' | 'after'
): Promise<string[]> {
  const supabase = createClient();
  const urls: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (!PHOTO_MIMES.includes(file.type)) continue;
    if (file.size > MAX_PHOTO_BYTES) continue;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${orgId}/${clientId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from('client-photos')
      .upload(path, new Uint8Array(buf), { contentType: file.type });
    if (upErr) continue;
    const { data: signed } = await supabase.storage
      .from('client-photos')
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signed?.signedUrl) urls.push(signed.signedUrl);
  }
  return urls;
}

export async function createTreatmentSession(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const serviceId = String(formData.get('service_id') ?? '') || null;
  const performedAt = String(formData.get('performed_at') ?? '') || new Date().toISOString();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const productsUsed = String(formData.get('products_used') ?? '').trim() || null;
  const parametersStr = String(formData.get('parameters') ?? '').trim();

  if (!clientId) redirect('/clientas?error=ID+invalido');

  let parameters: Record<string, string | number | boolean | null> = {};
  if (parametersStr) {
    try {
      parameters = JSON.parse(parametersStr);
    } catch {
      parameters = { raw: parametersStr };
    }
  }

  const beforeFiles = formData.getAll('photos_before').filter((v): v is File => v instanceof File);
  const afterFiles = formData.getAll('photos_after').filter((v): v is File => v instanceof File);

  const [beforeUrls, afterUrls] = await Promise.all([
    uploadPhotos(beforeFiles, orgId, clientId, 'before'),
    uploadPhotos(afterFiles, orgId, clientId, 'after'),
  ]);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('treatment_sessions').insert({
    organization_id: orgId,
    client_id: clientId,
    service_id: serviceId,
    professional_id: user?.id ?? null,
    performed_at: new Date(performedAt).toISOString(),
    parameters,
    photos_before_urls: beforeUrls,
    photos_after_urls: afterUrls,
    products_used: productsUsed,
    notes,
  });

  if (error) redirect(`/clientas/${clientId}?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath(`/clientas/${clientId}`);
  redirect(`/clientas/${clientId}?ok=sesion-creada`);
}

export async function deleteTreatmentSession(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/clientas?error=ID+invalido');

  const supabase = createClient();
  const { data: row } = await supabase
    .from('treatment_sessions')
    .select('client_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();
  const clientId = row?.client_id ?? null;

  const { error } = await supabase
    .from('treatment_sessions')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) {
    const target = clientId ? `/clientas/${clientId}` : '/clientas';
    redirect(`${target}?error=${encodeURIComponent(translateDbError(error))}`);
  }

  if (clientId) revalidatePath(`/clientas/${clientId}`);
  redirect(clientId ? `/clientas/${clientId}?ok=sesion-eliminada` : '/clientas');
}
