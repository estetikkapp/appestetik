/**
 * Vercel Cron — diario.
 *
 * Aplica cambios de plan diferidos (downgrades programados al fin del
 * período, cancelaciones que llegan a expirar) y expira trials que
 * llegaron a los 30 días sin método de pago.
 *
 * Configurar en vercel.json:
 *   { "path": "/api/cron/process-plan-changes", "schedule": "0 7 * * *" }
 *   (4am Argentina UTC-3 = 7am UTC)
 *
 * Idempotente: se puede correr varias veces el mismo día sin problema.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processDeferredChanges } from '@/lib/plans/subscription-service';

export const runtime = 'nodejs';

function authorizeCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization');
  const xCron = req.headers.get('x-cron-secret');
  return auth === `Bearer ${expected}` || xCron === expected;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const admin = createAdminClient();

  // 1) Aplicar plan_change_events pendientes (downgrades + cancelaciones que expiran)
  let processedChanges: string[] = [];
  try {
    processedChanges = await processDeferredChanges(now);
  } catch (err) {
    console.error('[cron process-plan-changes] processDeferredChanges fail:', err);
  }

  // 2) Expirar trials vencidos: trialing con trial_ends_at < now Y sin
  //    método de pago. Pasan a 'trial_expired' (read-only por 15 días).
  let trialExpiredCount = 0;
  try {
    const { data, error } = await admin
      .from('plan_subscriptions')
      .update({ status: 'trial_expired' })
      .eq('status', 'trialing')
      .lt('trial_ends_at', now.toISOString())
      .is('mp_preapproval_id', null) // sin preapproval = no pagó nunca
      .select('id');
    if (error) {
      console.error('[cron] expire trials fail:', error.message);
    } else {
      trialExpiredCount = data?.length ?? 0;
    }
  } catch (err) {
    console.error('[cron] expire trials exception:', err);
  }

  // 3) Archivar trial_expired pasados los 15 días de read-only: pasan a 'expired'
  const archiveCutoff = new Date(now);
  archiveCutoff.setUTCDate(archiveCutoff.getUTCDate() - 15);
  let archivedCount = 0;
  try {
    const { data, error } = await admin
      .from('plan_subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'trial_expired')
      .lt('trial_ends_at', archiveCutoff.toISOString())
      .select('id');
    if (error) {
      console.error('[cron] archive trial_expired fail:', error.message);
    } else {
      archivedCount = data?.length ?? 0;
    }
  } catch (err) {
    console.error('[cron] archive trial_expired exception:', err);
  }

  return NextResponse.json({
    ok: true,
    ran_at: now.toISOString(),
    deferred_changes_processed: processedChanges.length,
    trials_expired: trialExpiredCount,
    trials_archived: archivedCount,
  });
}
