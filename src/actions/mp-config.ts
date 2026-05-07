'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/utils/db-errors';
import { audit } from '@/lib/audit';
import { requireMembership } from '@/lib/auth/require-membership';

/**
 * Guarda credenciales Mercado Pago per-org. Solo owner/admin.
 *
 * El access_token de MP se obtiene en:
 *   Mercado Pago Dashboard → tu cuenta → Aplicaciones → "Crear" o existente →
 *   Credenciales de producción → Access Token (empieza con APP_USR-...)
 *
 * El webhook_secret es opcional pero recomendado: se obtiene en la misma
 * pantalla, sección "Webhooks → Configurar firma secreta".
 */
export async function saveMpConfig(formData: FormData): Promise<void> {
  const { orgId } = await requireMembership({ minRole: 'admin' });

  const accessToken = String(formData.get('access_token') ?? '').trim();
  const publicKey = String(formData.get('public_key') ?? '').trim() || null;
  const webhookSecret = String(formData.get('webhook_secret') ?? '').trim() || null;
  const enabled = formData.get('enabled') === 'on';

  // Si desactivó, borrar config
  if (!enabled) {
    const supabase = createClient();
    const { error } = await supabase
      .from('organizations')
      .update({ mp_config: null })
      .eq('id', orgId);
    if (error) redirect(`/configuracion?error=${encodeURIComponent(translateDbError(error))}`);

    await audit({
      organizationId: orgId,
      action: 'org.mp.disable',
      entityType: 'organization',
      entityId: orgId,
      payload: {},
    });

    revalidatePath('/configuracion');
    redirect('/configuracion?ok=mp-desactivado');
  }

  // Validación básica: token debe tener pinta de MP (APP_USR-... o TEST-...)
  if (!accessToken) {
    redirect('/configuracion?error=Falta+access+token+MP');
  }
  if (!accessToken.startsWith('APP_USR-') && !accessToken.startsWith('TEST-')) {
    redirect(
      '/configuracion?error=El+access+token+debe+empezar+con+APP_USR-+(producci%C3%B3n)+o+TEST-+(sandbox)'
    );
  }

  const config = {
    access_token: accessToken,
    public_key: publicKey,
    webhook_secret: webhookSecret,
  };

  const supabase = createClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mp_config: config as any,
    })
    .eq('id', orgId);

  if (error) redirect(`/configuracion?error=${encodeURIComponent(translateDbError(error))}`);

  await audit({
    organizationId: orgId,
    action: 'org.mp.configure',
    entityType: 'organization',
    entityId: orgId,
    payload: {
      env: accessToken.startsWith('TEST-') ? 'sandbox' : 'production',
      has_webhook_secret: !!webhookSecret,
    },
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=mp-configurado');
}
