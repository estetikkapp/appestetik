'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isValidCuit, normalizeCuit } from '@/lib/validators/cuit';
import type { TaxCondition } from '@/types/app';

async function requireOwnerOrAdmin(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');

  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .single();

  if (!m || !['owner', 'admin'].includes(m.role)) {
    redirect('/configuracion?error=Solo+owner+o+admin+puede+editar');
  }

  return orgId;
}

export async function updateOrganizationSettings(formData: FormData): Promise<void> {
  const orgId = await requireOwnerOrAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const legalName = String(formData.get('legal_name') ?? '').trim() || null;
  const cuit = String(formData.get('cuit') ?? '').trim();
  const taxCondition = String(formData.get('tax_condition') ?? '') as TaxCondition;

  if (!name) redirect('/configuracion?error=El+nombre+es+obligatorio');
  if (cuit && !isValidCuit(cuit)) redirect('/configuracion?error=CUIT+inv%C3%A1lido');

  const supabase = createClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      legal_name: legalName,
      cuit: cuit ? normalizeCuit(cuit) : null,
      tax_condition: taxCondition || null,
    })
    .eq('id', orgId);

  if (error) redirect(`/configuracion?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/configuracion');
  revalidatePath('/', 'layout');
  redirect('/configuracion?ok=guardado');
}
