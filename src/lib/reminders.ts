/**
 * Lógica de envío de recordatorios — usada tanto por el cron diario como
 * por el botón manual "Enviar recordatorio ahora" del panel.
 *
 * Estrategia:
 *  1. Si la org tiene WhatsApp conectado y la clienta tiene phone → WhatsApp
 *  2. Si WhatsApp falla o no disponible y la clienta tiene email → Resend
 *  3. Si nada disponible → skipped
 *
 * Marca `reminder_sent_at` solo si se envió correctamente por algún canal.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsappMessage } from '@/lib/integrations/whatsapp';
import { sendEmail } from '@/lib/integrations/email/resend';
import { appointmentReminderEmail } from '@/lib/integrations/email/templates';
import { formatInTimeZone } from 'date-fns-tz';

export type ReminderSkipReason =
  | 'not_found'
  | 'already_sent'
  | 'wrong_status'
  | 'no_client'
  | 'no_channel_available'
  | 'whatsapp_failed_email_unavailable'
  | 'email_no_api_key'
  | 'email_failed'
  | 'whatsapp_failed_no_email';

export interface ReminderOutcome {
  ok: boolean;
  sentVia: 'whatsapp' | 'email' | null;
  /** Razón del skip o error visible al usuario que intentó disparar manual */
  reason?: string;
  /** Código estructurado para clasificar (cron lo usa para contar skipped vs failed) */
  skipCode?: ReminderSkipReason;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  organization_id: string;
  organizations: {
    name: string;
    timezone: string | null;
    whatsapp_status: string | null;
  } | null;
  clients: {
    full_name: string;
    phone_e164: string | null;
    email: string | null;
  } | null;
  services: {
    name: string;
  } | null;
}

function buildReminderMessage(args: {
  clientName: string;
  orgName: string;
  serviceName: string;
  fecha: string;
  hora: string;
}) {
  return `Hola ${args.clientName} 👋

Te recordamos tu turno en *${args.orgName}* para mañana *${args.fecha}* a las *${args.hora}*.

📌 Servicio: ${args.serviceName}

Si necesitás reprogramar o cancelar, respondé este mensaje. ¡Gracias!`;
}

/**
 * Procesa el envío de un recordatorio para un appointment puntual.
 * `force=true` ignora `reminder_sent_at` (útil para reenvío manual).
 */
export async function sendAppointmentReminder(
  appointmentId: string,
  options: { force?: boolean } = {}
): Promise<ReminderOutcome> {
  const admin = createAdminClient();

  const { data: appt, error } = await admin
    .from('appointments')
    .select(
      `id, starts_at, organization_id, reminder_sent_at, status,
       organizations ( name, timezone, whatsapp_status ),
       clients ( full_name, phone_e164, email ),
       services ( name )`
    )
    .eq('id', appointmentId)
    .maybeSingle();

  if (error || !appt) {
    return {
      ok: false,
      sentVia: null,
      reason: 'Turno no encontrado',
      skipCode: 'not_found',
    };
  }

  if (!options.force && appt.reminder_sent_at) {
    return {
      ok: false,
      sentVia: null,
      reason: 'Ya se envió un recordatorio para este turno',
      skipCode: 'already_sent',
    };
  }

  if (!['pending', 'confirmed'].includes(appt.status as string)) {
    return {
      ok: false,
      sentVia: null,
      reason: `No se puede recordar un turno en estado ${appt.status}`,
      skipCode: 'wrong_status',
    };
  }

  const a = appt as unknown as AppointmentRow & { reminder_sent_at: string | null };
  const org = Array.isArray(a.organizations) ? a.organizations[0] : a.organizations;
  const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
  const service = Array.isArray(a.services) ? a.services[0] : a.services;

  if (!client) {
    return {
      ok: false,
      sentVia: null,
      reason: 'El turno no tiene clienta asociada',
      skipCode: 'no_client',
    };
  }

  const tz = org?.timezone ?? 'America/Argentina/Buenos_Aires';
  const hora = formatInTimeZone(new Date(a.starts_at), tz, 'HH:mm');
  const fecha = formatInTimeZone(new Date(a.starts_at), tz, "EEEE d 'de' MMMM");
  const fullDateAr = formatInTimeZone(
    new Date(a.starts_at),
    tz,
    "EEEE d 'de' MMMM 'a las' HH:mm"
  );

  const orgName = org?.name ?? 'tu centro';
  const serviceName = service?.name ?? 'tu servicio';

  const canWhatsapp = org?.whatsapp_status === 'connected' && !!client.phone_e164;
  const canEmail = !!client.email;

  if (!canWhatsapp && !canEmail) {
    return {
      ok: false,
      sentVia: null,
      reason:
        'La clienta no tiene teléfono ni email cargado, o WhatsApp del centro no está conectado',
      skipCode: 'no_channel_available',
    };
  }

  // Intentar WhatsApp primero
  if (canWhatsapp) {
    const message = buildReminderMessage({
      clientName: client.full_name,
      orgName,
      serviceName,
      fecha,
      hora,
    });
    try {
      await sendWhatsappMessage(a.organization_id, client.phone_e164!, message);
      // CRÍTICO: actualizar reminder_sent_at PRIMERO, después loguear. Si el
      // update falla, no marcamos la fila pero sí devolvemos error — el cron
      // lo reintenta y no se duplica el envío. El log es best-effort.
      const { error: updErr } = await admin
        .from('appointments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', a.id);
      if (updErr) {
        console.error(`[reminders] update reminder_sent_at falló post-WA: ${updErr.message}`);
        // El WhatsApp se mandó pero no podemos marcar — devolvemos error para
        // que el cron NO lo cuente como exitoso. La clienta puede recibir un
        // segundo recordatorio mañana — preferible a perder visibilidad.
        return {
          ok: false,
          sentVia: null,
          reason: 'WhatsApp enviado pero falló registrar el envío (posible reintento mañana)',
          skipCode: 'email_failed',
        };
      }
      await admin.from('whatsapp_reminder_log').insert({
        organization_id: a.organization_id,
        appointment_id: a.id,
        phone_e164: client.phone_e164!,
        message,
      });
      return { ok: true, sentVia: 'whatsapp' };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[reminders] WhatsApp fallo appt ${a.id}:`, errMsg);
      await admin.from('whatsapp_reminder_log').insert({
        organization_id: a.organization_id,
        appointment_id: a.id,
        phone_e164: client.phone_e164!,
        message,
        error: errMsg,
      });
      // No retornamos: probamos email como fallback abajo
    }
  }

  // Email como fallback
  if (canEmail) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';
    const tpl = appointmentReminderEmail({
      clientName: client.full_name,
      orgName,
      serviceName,
      startsAtFormatted: fullDateAr,
      cancelUrl: `${baseUrl}/turno/${a.id}/cancelar`,
    });
    const result = await sendEmail({
      to: client.email!,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: 'type', value: 'reminder' },
        { name: 'org_id', value: a.organization_id },
      ],
    });
    if (result.ok) {
      await admin
        .from('appointments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', a.id);
      return { ok: true, sentVia: 'email' };
    }
    return {
      ok: false,
      sentVia: null,
      reason:
        result.error === 'no_api_key'
          ? 'Email no configurado (falta RESEND_API_KEY) y WhatsApp no funcionó'
          : `Email falló: ${result.error}`,
      skipCode: result.error === 'no_api_key' ? 'email_no_api_key' : 'email_failed',
    };
  }

  return {
    ok: false,
    sentVia: null,
    reason: 'WhatsApp falló y la clienta no tiene email cargado',
    skipCode: 'whatsapp_failed_no_email',
  };
}
