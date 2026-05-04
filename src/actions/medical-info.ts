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

export async function upsertMedicalInfo(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  if (!clientId) redirect('/clientas?error=ID+invalido');

  const allergies = String(formData.get('allergies') ?? '').trim() || null;
  const medications = String(formData.get('medications') ?? '').trim() || null;
  const pregnancyStatus = String(formData.get('pregnancy_status') ?? '').trim() || null;
  const skinType = String(formData.get('skin_type') ?? '').trim() || null;
  const contraindications = String(formData.get('contraindications') ?? '').trim() || null;

  const supabase = createClient();
  const { error } = await supabase
    .from('client_medical_info')
    .upsert(
      {
        client_id: clientId,
        organization_id: orgId,
        allergies,
        medications,
        pregnancy_status: pregnancyStatus as 'no' | 'si' | 'lactancia' | 'trying' | 'unknown' | null,
        skin_type: skinType as 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null,
        contraindications,
      },
      { onConflict: 'client_id' }
    );

  if (error) redirect(`/clientas/${clientId}?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath(`/clientas/${clientId}`);
  redirect(`/clientas/${clientId}?ok=info-medica-guardada`);
}

export async function saveConsent(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const signatureDataUrl = String(formData.get('signature') ?? '');

  if (!clientId || !signatureDataUrl.startsWith('data:image/')) {
    redirect(`/clientas/${clientId}?error=Firma+invalida`);
  }

  const supabase = createClient();

  // Convert dataURL to buffer
  const base64 = signatureDataUrl.split(',')[1] ?? '';
  const buffer = Buffer.from(base64, 'base64');
  const path = `${orgId}/${clientId}/consent-${Date.now()}.png`;

  const { error: uploadErr } = await supabase.storage
    .from('consents')
    .upload(path, buffer, { contentType: 'image/png', upsert: false });

  if (uploadErr) redirect(`/clientas/${clientId}?error=${encodeURIComponent(uploadErr.message)}`);

  const { data: signed } = await supabase.storage
    .from('consents')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

  const { error: updErr } = await supabase
    .from('client_medical_info')
    .upsert(
      {
        client_id: clientId,
        organization_id: orgId,
        consent_signed_at: new Date().toISOString(),
        consent_signature_url: signed?.signedUrl ?? null,
      },
      { onConflict: 'client_id' }
    );

  if (updErr) redirect(`/clientas/${clientId}?error=${encodeURIComponent(translateDbError(updErr))}`);

  revalidatePath(`/clientas/${clientId}`);
  redirect(`/clientas/${clientId}?ok=consent-firmado`);
}
