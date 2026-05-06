'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { pingCloudApi, type WhatsappCloudConfig } from '@/lib/integrations/whatsapp/cloud-api';

async function requireOwnerOrAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    redirect('/configuracion?error=Solo+owner+o+admin+puede+configurar+WhatsApp');
  }
  return orgId;
}

/**
 * Cambia el provider de WhatsApp de la org y opcionalmente carga la config
 * de Cloud API. Si pasa de Evolution → Cloud y los campos están completos,
 * hace ping de validación antes de guardar y marca el estado como conectado.
 */
export async function saveWhatsappCloudConfig(formData: FormData): Promise<void> {
  const orgId = await requireOwnerOrAdmin();
  const provider = String(formData.get('provider') ?? '').trim();
  const phoneNumberId = String(formData.get('phone_number_id') ?? '').trim();
  const businessAccountId = String(formData.get('business_account_id') ?? '').trim();
  const accessToken = String(formData.get('access_token') ?? '').trim();
  const verifyToken = String(formData.get('verify_token') ?? '').trim();

  if (provider !== 'evolution' && provider !== 'cloud_api') {
    redirect('/configuracion?error=Provider+inválido');
  }

  const admin = createAdminClient();

  // Caso simple: solo cambiar a evolution. No tocamos credenciales cloud.
  if (provider === 'evolution') {
    await admin
      .from('organizations')
      .update({
        whatsapp_provider: 'evolution',
        // No reseteamos status: si había Evolution conectado, sigue OK.
      })
      .eq('id', orgId);

    await audit({
      organizationId: orgId,
      action: 'whatsapp.provider.switch',
      entityType: 'organization',
      entityId: orgId,
      payload: { to: 'evolution' },
    });

    revalidatePath('/configuracion');
    redirect('/configuracion?ok=guardado');
  }

  // Cloud API: requiere phone_number_id + access_token sí o sí
  if (!phoneNumberId || !accessToken) {
    redirect(
      '/configuracion?error=phone_number_id+y+access_token+son+obligatorios+para+Cloud+API'
    );
  }

  const config: WhatsappCloudConfig = {
    phone_number_id: phoneNumberId,
    business_account_id: businessAccountId || undefined,
    access_token: accessToken,
    verify_token: verifyToken || undefined,
  };

  // Validar credenciales antes de guardar (best-effort: si falla, igual guardamos
  // pero marcamos como disconnected. El usuario puede intentar después)
  const ping = await pingCloudApi(config);

  await admin
    .from('organizations')
    .update({
      whatsapp_provider: 'cloud_api',
      whatsapp_cloud_config: config as never, // jsonb passthrough
      whatsapp_status: ping.ok ? 'connected' : 'disconnected',
      whatsapp_phone: ping.ok
        ? `+${ping.phone.display_phone_number.replace(/\D/g, '')}`
        : null,
      whatsapp_connected_at: ping.ok ? new Date().toISOString() : null,
    })
    .eq('id', orgId);

  await audit({
    organizationId: orgId,
    action: 'whatsapp.cloud.config',
    entityType: 'organization',
    entityId: orgId,
    payload: {
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId || null,
      // NO loguear access_token
      ping_ok: ping.ok,
    },
  });

  revalidatePath('/configuracion');
  if (ping.ok) {
    redirect('/configuracion?ok=cloud-conectado');
  }
  redirect(
    `/configuracion?error=Credenciales+guardadas+pero+no+pude+validarlas:+${encodeURIComponent(
      ('message' in ping ? ping.message : 'desconocido') ?? ''
    )}`
  );
}
