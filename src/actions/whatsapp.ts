'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createInstance, deleteInstance } from '@/lib/integrations/whatsapp/evolution';

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

export async function connectWhatsappAction(): Promise<void> {
  const orgId = await requireOwnerOrAdmin();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`;

  try {
    await createInstance(orgId, webhookUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear instancia';
    redirect(`/configuracion?error=${encodeURIComponent(msg)}`);
  }

  const admin = createAdminClient();
  await admin
    .from('organizations')
    .update({ whatsapp_status: 'connecting' })
    .eq('id', orgId);

  revalidatePath('/configuracion');
  redirect('/configuracion?wapp=qr');
}

export async function disconnectWhatsappAction(): Promise<void> {
  const orgId = await requireOwnerOrAdmin();

  await deleteInstance(orgId);

  const admin = createAdminClient();
  await admin
    .from('organizations')
    .update({
      whatsapp_status: 'disconnected',
      whatsapp_phone: null,
      whatsapp_connected_at: null,
    })
    .eq('id', orgId);

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=whatsapp-desconectado');
}
