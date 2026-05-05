'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/utils/db-errors';
import { audit } from '@/lib/audit';

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
    redirect('/configuracion?error=Solo+owner+o+admin+puede+configurar+AFIP');
  }
  return orgId;
}

/**
 * Guarda credenciales AFIP per-org.
 * Provider: 'tusfacturas' o 'manual' (no facturación real).
 */
export async function saveAfipConfig(formData: FormData): Promise<void> {
  const orgId = await requireOwnerOrAdmin();
  const provider = String(formData.get('provider') ?? 'manual') as
    | 'tusfacturas'
    | 'direct'
    | 'manual';
  const apiKey = String(formData.get('api_key') ?? '').trim();
  const apiToken = String(formData.get('api_token') ?? '').trim();
  const userToken = String(formData.get('user_token') ?? '').trim();
  const pointOfSale = Number(formData.get('point_of_sale') ?? 1);

  let config: Record<string, string | number> | null = null;
  if (provider === 'tusfacturas') {
    if (!apiKey || !apiToken || !userToken) {
      redirect('/configuracion?error=Faltan+credenciales+TusFacturas');
    }
    config = {
      api_key: apiKey,
      api_token: apiToken,
      user_token: userToken,
      point_of_sale: pointOfSale,
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      afip_provider: provider,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      afip_config: (config ?? {}) as any,
    })
    .eq('id', orgId);

  if (error) redirect(`/configuracion?error=${encodeURIComponent(translateDbError(error))}`);

  await audit({
    organizationId: orgId,
    action: 'org.afip.configure',
    entityType: 'organization',
    entityId: orgId,
    payload: { provider },
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=afip-configurado');
}
