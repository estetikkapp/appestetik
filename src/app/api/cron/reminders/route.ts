// Vercel Cron Job — correr 1 vez al día (Vercel Hobby no permite cron horario).
// Busca turnos entre 12h y 36h desde ahora, sin reminder enviado,
// y manda WhatsApp si la org está conectada.
//
// Configurar en vercel.json: { "schedule": "0 9 * * *" } = 6am Argentina
// La ventana 12h-36h asegura que cada turno reciba 1 solo reminder.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTextMessage } from '@/lib/integrations/whatsapp/evolution';
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
      clients ( full_name, phone_e164 ),
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

  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const appt of appointments ?? []) {
    const org = Array.isArray(appt.organizations) ? appt.organizations[0] : appt.organizations;
    const client = Array.isArray(appt.clients) ? appt.clients[0] : appt.clients;
    const service = Array.isArray(appt.services) ? appt.services[0] : appt.services;

    // Saltar si la org no tiene WhatsApp conectado
    if (org?.whatsapp_status !== 'connected') {
      results.skipped++;
      continue;
    }

    // Saltar si la clienta no tiene teléfono
    if (!client?.phone_e164) {
      results.skipped++;
      continue;
    }

    const tz = org.timezone ?? 'America/Argentina/Buenos_Aires';
    const hora = formatInTimeZone(new Date(appt.starts_at), tz, 'HH:mm');
    const fecha = formatInTimeZone(new Date(appt.starts_at), tz, "EEEE d 'de' MMMM");

    const message = buildReminderMessage({
      clientName: client.full_name,
      orgName: org.name,
      serviceName: service?.name ?? 'tu servicio',
      fecha,
      hora,
    });

    try {
      await sendTextMessage(appt.organization_id, client.phone_e164, message);

      // Marcar reminder como enviado + loguear
      await Promise.all([
        admin
          .from('appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', appt.id),
        admin.from('whatsapp_reminder_log').insert({
          organization_id: appt.organization_id,
          appointment_id: appt.id,
          phone_e164: client.phone_e164,
          message,
        }),
      ]);

      results.sent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/reminders] fallo envío appt ${appt.id}:`, errMsg);

      // Loguear el error sin marcar como enviado (reintentará en próxima hora)
      await admin.from('whatsapp_reminder_log').insert({
        organization_id: appt.organization_id,
        appointment_id: appt.id,
        phone_e164: client.phone_e164,
        message,
        error: errMsg,
      });

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
