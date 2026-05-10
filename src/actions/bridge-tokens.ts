'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMembership } from '@/lib/auth/require-membership';
import { generateBridgeToken } from '@/lib/bridge/token';
import { audit } from '@/lib/audit';

/**
 * Genera un token nuevo para el bridge local. El plaintext se guarda en cookie
 * por 60 segundos para que la UI lo muestre UNA vez. Después la cookie se borra
 * y el plaintext se pierde para siempre (solo queda el hash en DB).
 *
 * Auth: owner o admin de la org activa.
 */
export async function createBridgeToken(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireMembership({ minRole: 'admin' });

  const label = String(formData.get('label') ?? '').trim().slice(0, 60) || 'PC sin nombre';

  const { plaintext, hash } = generateBridgeToken();

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from('bridge_tokens')
    .insert({
      organization_id: orgId,
      token_hash: hash,
      label,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !created) {
    redirect(
      `/configuracion?error=${encodeURIComponent('No se pudo generar el token: ' + (error?.message ?? 'desconocido'))}`
    );
  }

  // Stash el plaintext en una cookie de 60s para mostrarlo UNA vez en la UI
  cookies().set('bridge_new_token', plaintext, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60,
    path: '/configuracion',
  });
  cookies().set('bridge_new_token_id', created.id, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 60,
    path: '/configuracion',
  });

  await audit({
    organizationId: orgId,
    action: 'bridge.token.create',
    entityType: 'bridge_token',
    entityId: created.id,
    payload: { label },
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=bridge-token-creado');
}

/**
 * Revoca un token (soft delete). El bridge que lo use va a fallar el próximo
 * poll con 401 y la dueña tiene que generar uno nuevo.
 */
export async function revokeBridgeToken(formData: FormData): Promise<void> {
  const { orgId } = await requireMembership({ minRole: 'admin' });

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/configuracion?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('bridge_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('revoked_at', null);

  if (error) redirect(`/configuracion?error=${encodeURIComponent(error.message)}`);

  await audit({
    organizationId: orgId,
    action: 'bridge.token.revoke',
    entityType: 'bridge_token',
    entityId: id,
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=bridge-token-revocado');
}

/**
 * Cambia el provider de WhatsApp a 'local_bridge'.
 * (Helper para que el botón "Activar" en la UI funcione sin pasar por el
 * provider selector global de Cloud API.)
 */
export async function setWhatsappProviderLocalBridge(): Promise<void> {
  const { orgId } = await requireMembership({ minRole: 'admin' });

  const admin = createAdminClient();
  await admin
    .from('organizations')
    .update({
      whatsapp_provider: 'local_bridge',
      // No resetamos status: si ya había un bridge connected, sigue
    })
    .eq('id', orgId);

  await audit({
    organizationId: orgId,
    action: 'whatsapp.provider.switch',
    entityType: 'organization',
    entityId: orgId,
    payload: { to: 'local_bridge' },
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=bridge-activado');
}
