'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

export async function createResource(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();

  if (!name || !type) redirect('/recursos?error=Nombre+y+tipo+son+obligatorios');

  const supabase = createClient();
  const { error } = await supabase.from('resources').insert({
    organization_id: orgId,
    name,
    type,
  });

  if (error) redirect(`/recursos?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/recursos');
  redirect('/recursos?ok=creado');
}

export async function updateResource(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/recursos?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('resources')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      type: String(formData.get('type') ?? '').trim(),
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/recursos?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/recursos');
  redirect('/recursos?ok=actualizado');
}

export async function toggleResourceActive(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const supabase = createClient();
  const { error } = await supabase
    .from('resources')
    .update({ active: !active })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/recursos?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/recursos');
  redirect('/recursos');
}
