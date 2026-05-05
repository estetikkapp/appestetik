'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { translateDbError } from '@/lib/utils/db-errors';
import { sendTextMessage } from '@/lib/integrations/whatsapp/evolution';
import { notifyOrgAdmins } from '@/lib/notifications';
import { audit } from '@/lib/audit';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

/**
 * Dry-run: cuenta cuántos turnos pending/confirmed/in_progress quedarían
 * cancelados al aplicar este bloqueo. NO modifica nada.
 */
export async function dryRunClosure(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const startsAt = String(formData.get('starts_at') ?? '').trim();
  const endsAt = String(formData.get('ends_at') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const professionalAuthId = String(formData.get('professional_id') ?? '').trim() || null;
  const allDay = formData.get('all_day') === 'on';

  if (!startsAt || !endsAt || !reason) {
    redirect('/cierres?error=Fechas+y+motivo+requeridos');
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (end <= start) redirect('/cierres?error=Fin+debe+ser+posterior+al+inicio');

  const supabase = createClient();

  let conflictQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('status', ['pending', 'confirmed', 'in_progress'])
    .lt('starts_at', end.toISOString())
    .gt('ends_at', start.toISOString());

  if (professionalAuthId) {
    conflictQuery = conflictQuery.eq('professional_id', professionalAuthId);
  }

  const { count } = await conflictQuery;

  // Pasamos el resultado al UI mediante query params
  const params = new URLSearchParams({
    preview: '1',
    starts_at: startsAt,
    ends_at: endsAt,
    reason,
    affected: String(count ?? 0),
    all_day: String(allDay),
  });
  if (professionalAuthId) params.set('professional_id', professionalAuthId);

  redirect(`/cierres?${params.toString()}`);
}

/**
 * Aplica el cierre:
 * 1. Crea el schedule_block
 * 2. Cancela todos los turnos afectados con motivo
 * 3. Manda WhatsApp a cada clienta (best-effort)
 * 4. Notif al panel
 * 5. Audit log
 */
export async function applyClosure(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const startsAt = String(formData.get('starts_at') ?? '').trim();
  const endsAt = String(formData.get('ends_at') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const professionalAuthId = String(formData.get('professional_id') ?? '').trim() || null;
  const allDay = formData.get('all_day') === 'on';

  if (!startsAt || !endsAt || !reason) {
    redirect('/cierres?error=Fechas+y+motivo+requeridos');
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const supabase = createClient();
  const admin = createAdminClient();

  // 1. Crear el bloque
  const { data: blockRow, error: insertErr } = await supabase
    .from('schedule_blocks')
    .insert({
      organization_id: orgId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      reason,
      professional_id: professionalAuthId,
      all_day: allDay,
    })
    .select('id')
    .single();

  if (insertErr || !blockRow) {
    redirect(`/cierres?error=${encodeURIComponent(translateDbError(insertErr ?? { message: 'insert failed' }))}`);
  }

  // 2. Buscar turnos afectados (con datos para mensaje)
  let conflictQuery = admin
    .from('appointments')
    .select(`id, starts_at, organization_id,
             client:clients(full_name, phone_e164),
             service:services(name)`)
    .eq('organization_id', orgId)
    .in('status', ['pending', 'confirmed', 'in_progress'])
    .lt('starts_at', end.toISOString())
    .gt('ends_at', start.toISOString());
  if (professionalAuthId) {
    conflictQuery = conflictQuery.eq('professional_id', professionalAuthId);
  }
  const { data: affected } = await conflictQuery;

  // 3. Cancelar todos
  if (affected && affected.length > 0) {
    const ids = affected.map((a) => a.id);
    await admin
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: `[Cierre del centro] ${reason}`,
      })
      .in('id', ids);

    // 4. WhatsApp a clientas (best-effort, parallel)
    const { data: org } = await admin
      .from('organizations')
      .select('name, whatsapp_status')
      .eq('id', orgId)
      .single();

    if (org?.whatsapp_status === 'connected') {
      await Promise.all(
        affected.map(async (a) => {
          const cli = Array.isArray(a.client) ? a.client[0] : a.client;
          const svc = Array.isArray(a.service) ? a.service[0] : a.service;
          if (!cli?.phone_e164) return;
          const fechaTexto = new Date(a.starts_at).toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          });
          const message = `Hola ${cli.full_name} 👋

Lamentamos informarte que tu turno en *${org.name}* del ${fechaTexto} fue cancelado.

📌 Servicio: ${svc?.name ?? '—'}
📝 Motivo: ${reason}

Por favor contactanos para reagendar.`;
          try {
            await sendTextMessage(orgId, cli.phone_e164, message);
          } catch (err) {
            console.error('[closure] whatsapp send fail', a.id, err);
          }
        })
      );

      await admin
        .from('schedule_blocks')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', blockRow.id);
    }
  }

  // 5. Audit + notif al panel
  await Promise.all([
    audit({
      organizationId: orgId,
      action: 'closure.apply',
      entityType: 'closure',
      entityId: blockRow.id,
      payload: { reason, affected_count: affected?.length ?? 0, all_day: allDay, professional_id: professionalAuthId },
    }),
    notifyOrgAdmins(
      orgId,
      'closure_applied',
      `Cierre aplicado: ${reason}`,
      `${affected?.length ?? 0} turnos cancelados.`,
      '/cierres'
    ),
  ]);

  revalidatePath('/cierres');
  revalidatePath('/agenda');
  redirect(`/cierres?ok=aplicado&affected=${affected?.length ?? 0}`);
}

export async function deleteClosure(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/cierres?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('schedule_blocks')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/cierres?error=${encodeURIComponent(translateDbError(error))}`);

  await audit({
    organizationId: orgId,
    action: 'closure.delete',
    entityType: 'closure',
    entityId: id,
  });

  revalidatePath('/cierres');
  redirect('/cierres?ok=eliminado');
}
