'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { translateDbError } from '@/lib/utils/db-errors';
import { sendWhatsappMessage } from '@/lib/integrations/whatsapp';
import { audit } from '@/lib/audit';
import type { AppointmentStatus } from '@/types/app';
import type { TablesUpdate } from '@/types/database';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

interface ConflictCheckParams {
  orgId: string;
  startsAt: string;
  endsAt: string;
  professionalId: string | null;
  resourceId: string | null;
  excludeAppointmentId?: string;
}

/**
 * Detecta conflictos de agenda:
 * - Mismo profesional con turno solapado (no cancelado)
 * - Mismo recurso con turno solapado (no cancelado)
 * - Bloqueo de schedule (vacaciones, mantenimiento) solapado para ese profesional/recurso
 *
 * Retorna mensaje de conflicto o null si está libre.
 */
async function detectConflict(params: ConflictCheckParams): Promise<string | null> {
  const supabase = createClient();

  const [apptResult, blockResult] = await Promise.all([
    // Turnos solapados
    (async () => {
      let query = supabase
        .from('appointments')
        .select('id, starts_at, ends_at, professional_id, resource_id, status')
        .eq('organization_id', params.orgId)
        .in('status', ['pending', 'confirmed', 'in_progress'])
        .lt('starts_at', params.endsAt)
        .gt('ends_at', params.startsAt);

      if (params.excludeAppointmentId) query = query.neq('id', params.excludeAppointmentId);

      const { data } = await query;
      return data ?? [];
    })(),

    // Bloqueos de schedule solapados
    supabase
      .from('schedule_blocks')
      .select('id, reason, professional_id, resource_id')
      .eq('organization_id', params.orgId)
      .lt('starts_at', params.endsAt)
      .gt('ends_at', params.startsAt),
  ]);

  // Conflicto: turno con mismo profesional
  if (params.professionalId) {
    const clash = apptResult.find((a) => a.professional_id === params.professionalId);
    if (clash) return `El/la profesional ya tiene un turno superpuesto`;
  }

  // Conflicto: turno con mismo recurso
  if (params.resourceId) {
    const clash = apptResult.find((a) => a.resource_id === params.resourceId);
    if (clash) return `El recurso ya está ocupado en ese horario`;
  }

  // Conflicto: bloqueo
  const blocks = blockResult.data ?? [];
  const relevantBlock = blocks.find((b) => {
    const appliesToProfessional =
      b.professional_id && params.professionalId && b.professional_id === params.professionalId;
    const appliesToResource =
      b.resource_id && params.resourceId && b.resource_id === params.resourceId;
    const appliesToOrg = !b.professional_id && !b.resource_id; // bloqueo global
    return appliesToProfessional || appliesToResource || appliesToOrg;
  });
  if (relevantBlock) {
    return `Hay un bloqueo en ese horario (${relevantBlock.reason})`;
  }

  return null;
}

export async function createAppointment(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const serviceId = String(formData.get('service_id') ?? '');
  const professionalId = String(formData.get('professional_id') ?? '') || null;
  const resourceId = String(formData.get('resource_id') ?? '') || null;
  const startsAt = String(formData.get('starts_at') ?? '');
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!clientId) redirect('/agenda?error=Clienta+requerida');
  if (!serviceId) redirect('/agenda?error=Servicio+requerido');
  if (!startsAt) redirect('/agenda?error=Fecha+y+hora+requeridas');

  const supabase = createClient();

  // Obtener duración del servicio para calcular ends_at
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, buffer_minutes')
    .eq('id', serviceId)
    .eq('organization_id', orgId)
    .single();

  if (!service) redirect('/agenda?error=Servicio+no+encontrado');

  const startDate = new Date(startsAt);
  const totalMinutes = service.duration_minutes + (service.buffer_minutes ?? 0);
  const endDate = new Date(startDate.getTime() + totalMinutes * 60 * 1000);

  const conflict = await detectConflict({
    orgId,
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString(),
    professionalId,
    resourceId,
  });

  if (conflict) redirect(`/agenda?error=${encodeURIComponent(conflict)}`);

  const { error } = await supabase.from('appointments').insert({
    organization_id: orgId,
    client_id: clientId,
    service_id: serviceId,
    professional_id: professionalId,
    resource_id: resourceId,
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    notes,
    source: 'panel',
  });

  if (error) redirect(`/agenda?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/agenda');
  redirect('/agenda?ok=creado');
}

export async function updateAppointmentStatus(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as AppointmentStatus;
  const reason = String(formData.get('reason') ?? '').trim() || null;

  if (!id) redirect('/agenda?error=ID+invalido');

  const updates: TablesUpdate<'appointments'> = { status };
  if (status === 'in_progress') updates.checked_in_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  if (status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
    updates.cancellation_reason = reason;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/agenda?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/agenda');
  redirect('/agenda');
}

export async function deleteAppointment(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/agenda?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/agenda?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/agenda');
  redirect('/agenda?ok=eliminado');
}

export async function deleteScheduleBlock(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/agenda?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('schedule_blocks')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/agenda?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/agenda');
  redirect('/agenda?ok=bloqueo-eliminado');
}

/**
 * Reagenda un turno existente a un nuevo starts_at.
 *
 * - Recalcula ends_at desde la duración del service (preserva el servicio actual)
 * - Detecta conflictos (excluyendo el propio turno)
 * - Si la org tiene WhatsApp conectado y la clienta tiene tel, le avisa
 *   del cambio (best-effort)
 * - Audit log con before/after
 */
export async function rescheduleAppointment(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const newStartsAt = String(formData.get('starts_at') ?? '').trim();
  const notify = formData.get('notify_client') === 'on';

  if (!id) redirect('/agenda?error=ID+invalido');
  if (!newStartsAt) redirect('/agenda?error=Falta+nueva+fecha%2Fhora');

  const newStart = new Date(newStartsAt);
  if (isNaN(newStart.getTime())) {
    redirect('/agenda?error=Fecha+u+hora+inv%C3%A1lida');
  }
  if (newStart.getTime() < Date.now() - 60 * 1000) {
    redirect('/agenda?error=La+nueva+fecha+no+puede+estar+en+el+pasado');
  }

  const supabase = createClient();

  // Cargar el turno actual con todo lo que necesitamos para validar y notificar
  const { data: current } = await supabase
    .from('appointments')
    .select(
      `id, starts_at, ends_at, status, professional_id, resource_id, service_id,
       client:clients(full_name, phone_e164),
       service:services(name, duration_minutes, buffer_minutes)`
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!current) redirect('/agenda?error=Turno+no+encontrado');
  if (current.status === 'cancelled' || current.status === 'completed' || current.status === 'no_show') {
    redirect('/agenda?error=No+se+puede+reagendar+un+turno+cerrado');
  }

  const svc = Array.isArray(current.service) ? current.service[0] : current.service;
  if (!svc) redirect('/agenda?error=Servicio+del+turno+no+encontrado');

  const totalMinutes = svc.duration_minutes + (svc.buffer_minutes ?? 0);
  const newEnd = new Date(newStart.getTime() + totalMinutes * 60 * 1000);

  const conflict = await detectConflict({
    orgId,
    startsAt: newStart.toISOString(),
    endsAt: newEnd.toISOString(),
    professionalId: current.professional_id,
    resourceId: current.resource_id,
    excludeAppointmentId: id,
  });
  if (conflict) redirect(`/agenda?error=${encodeURIComponent(conflict)}`);

  const { error } = await supabase
    .from('appointments')
    .update({
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
      reminder_sent_at: null, // resetear reminder por si estaba marcado
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/agenda?error=${encodeURIComponent(translateDbError(error))}`);

  // Audit
  await audit({
    organizationId: orgId,
    action: 'appointment.reschedule',
    entityType: 'appointment',
    entityId: id,
    payload: {
      from: current.starts_at,
      to: newStart.toISOString(),
    },
  });

  // Best-effort: avisar a la clienta por WhatsApp si lo pidió
  if (notify) {
    const cli = Array.isArray(current.client) ? current.client[0] : current.client;
    if (cli?.phone_e164) {
      const admin = createAdminClient();
      const { data: org } = await admin
        .from('organizations')
        .select('name, whatsapp_status')
        .eq('id', orgId)
        .maybeSingle();

      if (org?.whatsapp_status === 'connected') {
        const fechaTexto = newStart.toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });
        const message = `Hola ${cli.full_name} 👋

Tu turno en *${org.name}* fue reagendado.

📅 Nueva fecha: *${fechaTexto}*
📌 Servicio: ${svc.name}

Si esto no te queda bien, respondé este mensaje y coordinamos.`;
        try {
          await sendWhatsappMessage(orgId, cli.phone_e164, message);
        } catch (err) {
          console.error('[reschedule] whatsapp send fail', err);
        }
      }
    }
  }

  revalidatePath('/agenda');

  // Redirigir al día del nuevo turno (usando TZ AR)
  const newDateAr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(newStart);
  redirect(`/agenda?date=${newDateAr}&ok=reagendado`);
}

export async function createScheduleBlock(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const startsAt = String(formData.get('starts_at') ?? '');
  const endsAt = String(formData.get('ends_at') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const professionalId = String(formData.get('professional_id') ?? '') || null;
  const resourceId = String(formData.get('resource_id') ?? '') || null;

  if (!startsAt || !endsAt || !reason) {
    redirect('/agenda?error=Fechas+y+motivo+requeridos');
  }

  const supabase = createClient();
  const { error } = await supabase.from('schedule_blocks').insert({
    organization_id: orgId,
    professional_id: professionalId,
    resource_id: resourceId,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    reason,
  });

  if (error) redirect(`/agenda?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/agenda');
  redirect('/agenda?ok=bloqueo-creado');
}
