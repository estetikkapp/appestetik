'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { translateDbError } from '@/lib/utils/db-errors';
import { sendWhatsappMessage } from '@/lib/integrations/whatsapp';
import { audit } from '@/lib/audit';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

/**
 * Agregar una clienta existente a la lista de espera para un servicio.
 * Acción del panel (staff con activeOrg).
 */
export async function addToWaitlist(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '').trim();
  const serviceId = String(formData.get('service_id') ?? '').trim();
  const preferredDate = String(formData.get('preferred_date') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!clientId || !serviceId) {
    redirect('/espera?error=Cliente+y+servicio+requeridos');
  }

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from('waitlist_entries')
    .insert({
      organization_id: orgId,
      client_id: clientId,
      service_id: serviceId,
      preferred_date: preferredDate,
      notes,
    })
    .select('id')
    .single();

  if (error || !row) {
    redirect(
      `/espera?error=${encodeURIComponent(translateDbError(error ?? { message: 'insert failed' }))}`
    );
  }

  await audit({
    organizationId: orgId,
    action: 'waitlist.add',
    entityType: 'waitlist',
    entityId: row.id,
    payload: { client_id: clientId, service_id: serviceId, preferred_date: preferredDate },
  });

  revalidatePath('/espera');
  redirect('/espera?ok=agregada');
}

/**
 * Notificar a la clienta que se liberó un turno.
 * Si la org tiene WhatsApp conectado, envía mensaje y marca como 'notified'.
 * Si no, igual marca como 'notified' (asumimos que el staff llamó manualmente).
 */
export async function notifyWaitlistEntry(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const customMessage = String(formData.get('message') ?? '').trim();

  if (!id) redirect('/espera?error=ID+invalido');

  const admin = createAdminClient();

  const { data: entry } = await admin
    .from('waitlist_entries')
    .select(
      `id,
       client:clients(full_name, phone_e164),
       service:services(name),
       organization:organizations(name, whatsapp_status)`
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!entry) redirect('/espera?error=Entrada+no+encontrada');

  const cli = Array.isArray(entry.client) ? entry.client[0] : entry.client;
  const svc = Array.isArray(entry.service) ? entry.service[0] : entry.service;
  const org = Array.isArray(entry.organization) ? entry.organization[0] : entry.organization;

  if (!cli?.phone_e164) {
    // Marcar como notified igual (presumimos contacto manual)
    await admin
      .from('waitlist_entries')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', id);

    await audit({
      organizationId: orgId,
      action: 'waitlist.notify.manual',
      entityType: 'waitlist',
      entityId: id,
    });

    revalidatePath('/espera');
    redirect('/espera?ok=marcada+manual');
  }

  const message =
    customMessage ||
    `Hola ${cli.full_name} 👋

Te avisamos desde *${org?.name ?? 'el centro'}* que se liberó un turno para *${svc?.name ?? 'tu servicio'}*.

Si querés tomarlo, respondé este mensaje y coordinamos. ¡Gracias por esperar!`;

  if (org?.whatsapp_status !== 'connected') {
    // No hay WhatsApp conectado — sólo marcamos como notificada (asumimos llamada/manual)
    await admin
      .from('waitlist_entries')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', id);

    await audit({
      organizationId: orgId,
      action: 'waitlist.notify.manual',
      entityType: 'waitlist',
      entityId: id,
    });

    revalidatePath('/espera');
    redirect('/espera?ok=marcada+manual');
  }

  try {
    await sendWhatsappMessage(orgId, cli.phone_e164, message);
    await admin
      .from('waitlist_entries')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('id', id);

    await audit({
      organizationId: orgId,
      action: 'waitlist.notify',
      entityType: 'waitlist',
      entityId: id,
    });

    revalidatePath('/espera');
    redirect('/espera?ok=notificada');
  } catch (err) {
    console.error('[waitlist notify]', err);
    redirect('/espera?error=Error+enviando+WhatsApp');
  }
}

/**
 * Marcar una entrada como reservada (cuando la clienta confirma y le hicimos el turno).
 */
export async function markWaitlistBooked(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/espera?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('waitlist_entries')
    .update({ status: 'booked' })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/espera?error=${encodeURIComponent(translateDbError(error))}`);

  await audit({
    organizationId: orgId,
    action: 'waitlist.book',
    entityType: 'waitlist',
    entityId: id,
  });

  revalidatePath('/espera');
  redirect('/espera?ok=reservada');
}

/**
 * Cancelar una entrada (la clienta ya no quiere esperar).
 */
export async function cancelWaitlistEntry(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/espera?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('waitlist_entries')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/espera?error=${encodeURIComponent(translateDbError(error))}`);

  await audit({
    organizationId: orgId,
    action: 'waitlist.cancel',
    entityType: 'waitlist',
    entityId: id,
  });

  revalidatePath('/espera');
  redirect('/espera?ok=cancelada');
}

/**
 * Eliminar permanentemente la entrada del registro.
 */
export async function deleteWaitlistEntry(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/espera?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('waitlist_entries')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/espera?error=${encodeURIComponent(translateDbError(error))}`);

  await audit({
    organizationId: orgId,
    action: 'waitlist.delete',
    entityType: 'waitlist',
    entityId: id,
  });

  revalidatePath('/espera');
  redirect('/espera?ok=eliminada');
}
