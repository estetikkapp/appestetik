// Vercel Cron Job — correr 1 vez al día (Vercel Hobby no permite cron horario).
// Busca turnos entre 12h y 36h desde ahora, sin reminder enviado,
// y manda WhatsApp/email vía la lib lib/reminders.ts (la misma que usa
// el botón manual del panel).
//
// Configurar en vercel.json: { "schedule": "0 9 * * *" } = 6am Argentina
// La ventana 12h-36h asegura que cada turno reciba 1 solo reminder.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAppointmentReminder } from '@/lib/reminders';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Acepta solo via header (no query param para evitar logging del secret).
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

  const { data: appointments, error } = await admin
    .from('appointments')
    .select('id')
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .is('reminder_sent_at', null)
    .in('status', ['pending', 'confirmed']);

  if (error) {
    console.error('[cron/reminders] query error', error);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const results = { sent_whatsapp: 0, sent_email: 0, skipped: 0, failed: 0 };

  // Códigos que cuentan como "skipped" (no son errores de la app) vs "failed"
  // (algo falló inesperadamente y conviene investigar).
  const SKIP_CODES = new Set([
    'already_sent',
    'wrong_status',
    'no_client',
    'no_channel_available',
  ]);

  for (const appt of appointments ?? []) {
    const outcome = await sendAppointmentReminder(appt.id);
    if (outcome.ok && outcome.sentVia === 'whatsapp') {
      results.sent_whatsapp++;
    } else if (outcome.ok && outcome.sentVia === 'email') {
      results.sent_email++;
    } else if (outcome.skipCode && SKIP_CODES.has(outcome.skipCode)) {
      results.skipped++;
    } else {
      results.failed++;
    }
  }

  console.log('[cron/reminders] resultado:', results);
  return NextResponse.json(results);
}
