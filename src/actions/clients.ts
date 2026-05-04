'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isValidDni, normalizeDni } from '@/lib/validators/dni';
import { isValidPhoneAr, normalizePhoneAr } from '@/lib/validators/phone-ar';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';
import { translateDbError } from '@/lib/utils/db-errors';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

function parseClientFormData(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const rawPhone = String(formData.get('phone_e164') ?? '').trim();
  const rawEmail = String(formData.get('email') ?? '').trim();
  const rawBirthdate = String(formData.get('birthdate') ?? '').trim();
  const rawDni = String(formData.get('dni') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  return {
    fullName,
    phone: rawPhone ? normalizePhoneAr(rawPhone) : null,
    email: rawEmail ? normalizeEmail(rawEmail) : null,
    birthdate: rawBirthdate || null,
    dni: rawDni ? normalizeDni(rawDni) : null,
    notes,
    rawPhone,
    rawEmail,
    rawDni,
  };
}

function validateClient(p: ReturnType<typeof parseClientFormData>): string | null {
  if (!p.fullName) return 'El nombre es obligatorio';
  if (p.rawPhone && !isValidPhoneAr(p.rawPhone)) return 'Teléfono inválido';
  if (p.rawEmail && !isValidEmail(p.rawEmail)) return 'Email inválido';
  if (p.rawDni && !isValidDni(p.rawDni)) return 'DNI inválido';
  return null;
}

export async function createClientRecord(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const parsed = parseClientFormData(formData);
  const error = validateClient(parsed);
  if (error) redirect(`/clientas?error=${encodeURIComponent(error)}`);

  const supabase = createClient();
  const { error: dbError } = await supabase.from('clients').insert({
    organization_id: orgId,
    full_name: parsed.fullName,
    phone_e164: parsed.phone,
    email: parsed.email,
    birthdate: parsed.birthdate,
    dni: parsed.dni,
    notes: parsed.notes,
  });

  if (dbError) redirect(`/clientas?error=${encodeURIComponent(dbError.message)}`);

  revalidatePath('/clientas');
  redirect('/clientas?ok=creada');
}

export async function updateClientRecord(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/clientas?error=ID+invalido');

  const parsed = parseClientFormData(formData);
  const error = validateClient(parsed);
  if (error) redirect(`/clientas?error=${encodeURIComponent(error)}`);

  const supabase = createClient();
  const { error: dbError } = await supabase
    .from('clients')
    .update({
      full_name: parsed.fullName,
      phone_e164: parsed.phone,
      email: parsed.email,
      birthdate: parsed.birthdate,
      dni: parsed.dni,
      notes: parsed.notes,
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (dbError) redirect(`/clientas?error=${encodeURIComponent(dbError.message)}`);

  revalidatePath('/clientas');
  redirect('/clientas?ok=actualizada');
}

export async function deleteClient(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/clientas?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/clientas?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/clientas');
  redirect('/clientas?ok=eliminada');
}

export async function searchClients(query: string): Promise<Array<{ id: string; full_name: string; phone_e164: string | null; dni: string | null }>> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return [];
  if (!query || query.length < 2) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, phone_e164, dni')
    .eq('organization_id', orgId)
    .or(`full_name.ilike.%${query}%,phone_e164.ilike.%${query}%,dni.ilike.%${query}%`)
    .limit(50);

  return data ?? [];
}
