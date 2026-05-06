// Vercel Cron Job — correr 1 vez al día (Vercel Hobby no permite cron horario).
// Busca turnos entre 12h y 36h desde ahora, sin reminder enviado,
// y manda WhatsApp si la org está conectada.
//
// Configurar en vercel.json: { "schedule": "0 9 * * *" } = 6am Argentina
// La ventana 12h-36h asegura que cada turno reciba 1 solo reminder.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTextMessage } from '@/lib/integrations/whatsapp/evolution';
import { sendEmail } from '@/lib/integrations/email/resend';
import { appointmentReminderEmail } from '@/lib/integrations/email/templates';
import { formatInTimeZone } from 'date-fns-tz';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Acepta solo via header (no query param para evitar logging del secret)
  // Vercel Cron envía Authorization: Bearer <CRON_SECRET>; también soportamos x-cron-secret.
  const authHeader = req.headers.get('authorization');
  const xCronSecret = req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  const authorized =
    !!expected &&
    (xCronSecret === expected || authHeader === `Bearer ${expected}`);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  // Traer turnos dentro de la ventana, sin reminder enviado, estados activos
  const { data: appointments, error } = await admin
    .from('appointments')
    .select(`
      id,
      starts_at,
      organization_id,
      organizations ( name, timezone, whatsapp_status ),
      clients ( full_name, phone_e164, email ),
      services ( name, duration_minutes )
    `)
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .is('reminder_sent_at', null)
    .in('status', ['pending', 'confirmed']);

  if (error) {
    console.error('[cron/reminders] query error', error);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const results = { sent: 0, sentEmail: 0, skipped: 0, failed: 0 };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

  for (const appt of appointments ?? []) {
    const org = Array.isArray(appt.organizations) ? appt.organizations[0] : appt.organizations;
    const client = Array.isArray(appt.clients) ? appt.clients[0] : appt.clients;
    const service = Array.isArray(appt.services) ? appt.services[0] : appt.services;

    if (!client) {
      results.skipped++;
      continue;
    }

    const tz = org?.timezone ?? 'America/Argentina/Buenos_Aires';
    const hora = formatInTimeZone(new Date(appt.starts_at), tz, 'HH:mm');
    const fecha = formatInTimeZone(new Date(appt.starts_at), tz, "EEEE d 'de' MMMM");
    const fullDateAr = formatInTimeZone(new Date(appt.starts_at), tz, "EEEE d 'de' MMMM 'a las' HH:mm");

    const orgName = org?.name ?? 'tu centro';
    const serviceName = service?.name ?? 'tu servicio';

    // Decidir canal: WhatsApp si la org está conectada y la clienta tiene tel,
    // si no email si la clienta tiene email cargado.
    const canWhatsapp = org?.whatsapp_status === 'connected' && !!client.phone_e164;
    const canEmail = !!client.email;

    if (!canWhatsapp && !canEmail) {
      results.skipped++;
      continue;
    }

    let sentVia: 'whatsapp' | 'email' | null = null;
    let lastError: string | null = null;

    // Intentar primero WhatsApp si está disponible
    if (canWhatsapp) {
      const message = buildReminderMessage({
        clientName: client.full_name,
        orgName,
        serviceName,
        fecha,
        hora,
      });
      try {
        await sendTextMessage(appt.organization_id, client.phone_e164!, message);
        await admin.from('whatsapp_reminder_log').insert({
          organization_id: appt.organization_id,
          appointment_id: appt.id,
          phone_e164: client.phone_e164!,
          message,
        });
        sentVia = 'whatsapp';
        results.sent++;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[cron/reminders] WhatsApp fallo appt ${appt.id}:`, lastError);
        // log error sin marcar como enviado todavía → fallback a email si tiene
        await admin.from('whatsapp_reminder_log').insert({
          organization_id: appt.organization_id,
          appointment_id: appt.id,
          phone_e164: client.phone_e164!,
          message,
          error: lastError,
        });
      }
    }

    // Si WhatsApp no funcionó (o no disponible) y tiene email, mandar email
    if (sentVia === null && canEmail) {
      const tpl = appointmentReminderEmail({
        clientName: client.full_name,
        orgName,
        serviceName,
        startsAtFormatted: fullDateAr,
        cancelUrl: `${baseUrl}/turno/${appt.id}/cancelar`,
      });
      const result = await sendEmail({
        to: client.email!,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tags: [
          { name: 'type', value: 'reminder' },
          { name: 'org_id', value: appt.organization_id },
        ],
      });
      if (result.ok) {
        sentVia = 'email';
        results.sentEmail++;
      } else {
        lastError = result.error ?? 'email failed';
        console.error(`[cron/reminders] email fallo appt ${appt.id}:`, lastError);
      }
    }

    if (sentVia !== null) {
      await admin
        .from('appointments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', appt.id);
    } else {
      results.failed++;
    }
  }

  console.log('[cron/reminders] resultado:', results);
  return NextResponse.json(results);
}

function buildReminderMessage({
  clientName,
  orgName,
  serviceName,
  fecha,
  hora,
}: {
  clientName: string;
  orgName: string;
  serviceName: string;
  fecha: string;
  hora: string;
}) {
  return `Hola ${clientName} 👋

Te recordamos tu turno en *${orgName}* para mañana *${fecha}* a las *${hora}*.

📌 Servicio: ${serviceName}

Si necesitás reprogramar o cancelar, respondé este mensaje. ¡Gracias!`;
}
