/**
 * Vercel Cron — diario.
 *
 * Manda mails de recuperación a owners que crearon cuenta pero no terminaron
 * onboarding. 3 emails escalonados:
 *   - recovery_1: 24h post-signup (tono suave)
 *   - recovery_2: 72h post-signup (foco en valor + recordatorio de trial)
 *   - recovery_3: 168h (7 días) post-signup (último intento)
 *
 * Criterios para mandar:
 *   1. Owner activo de una organización (membership.role='owner', active=true)
 *   2. organization.onboarded_at IS NULL (no terminó setup inicial)
 *   3. organization.legacy_grandfathered = false (los grandfathered no van por
 *      el flow normal — son seeded manualmente)
 *   4. auth.users.created_at < now() - threshold del kind
 *   5. No existe row en onboarding_recovery_emails para (user_id, email_kind)
 *
 * Dedup via UNIQUE(user_id, email_kind) — si se corre dos veces en el día
 * no spammea. Insertamos la row DESPUÉS del send con el messageId (o
 * failed_reason si Resend rechazó).
 *
 * Configurar en vercel.json:
 *   { "path": "/api/cron/onboarding-recovery", "schedule": "0 13 * * *" }
 *   (10am Argentina UTC-3 = 13:00 UTC — hora "civilizada" para que no
 *    caigan los mails de madrugada)
 *
 * Idempotente: dedup por (user_id, email_kind) en DB.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  RECOVERY_THRESHOLDS_HOURS,
  sendRecoveryEmail,
  type RecoveryEmailKind,
} from '@/lib/notifications/onboarding-recovery';

export const runtime = 'nodejs';
// El cron puede tardar varios segundos si hay muchos candidatos. Bajamos el
// max duration para que Vercel no nos corte si toca un día con bocha de signups.
export const maxDuration = 60;

function authorizeCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization');
  const xCron = req.headers.get('x-cron-secret');
  return auth === `Bearer ${expected}` || xCron === expected;
}

interface KindResult {
  candidates: number;
  sent: number;
  failed: number;
  skipped_no_email: number;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const admin = createAdminClient();

  // Procesamos los 3 kinds en orden cronológico (24h → 72h → 168h).
  // Si por algún motivo un user nunca recibió el 1° pero ya pasaron 7 días,
  // recibe los 3 en el mismo día — está bien, el 1° es un "perdón, te llegamos
  // tarde" implícito y los 3 son mensajes distintos.
  const kinds: RecoveryEmailKind[] = ['recovery_1', 'recovery_2', 'recovery_3'];
  const results: Record<RecoveryEmailKind, KindResult> = {
    recovery_1: { candidates: 0, sent: 0, failed: 0, skipped_no_email: 0 },
    recovery_2: { candidates: 0, sent: 0, failed: 0, skipped_no_email: 0 },
    recovery_3: { candidates: 0, sent: 0, failed: 0, skipped_no_email: 0 },
  };

  for (const kind of kinds) {
    const threshold = RECOVERY_THRESHOLDS_HOURS[kind];
    const cutoff = new Date(now.getTime() - threshold * 60 * 60 * 1000);

    // Para el upper bound usamos el threshold del kind SIGUIENTE (si existe).
    // Esto evita que el cron mande el 1° mail a un user que ya está en ventana
    // del 2° — los tomamos por etapa, no acumulativamente. El último kind
    // no tiene upper bound porque es el "último intento".
    let upperBound: Date | null = null;
    if (kind === 'recovery_1') {
      upperBound = new Date(now.getTime() - RECOVERY_THRESHOLDS_HOURS.recovery_2 * 60 * 60 * 1000);
    } else if (kind === 'recovery_2') {
      upperBound = new Date(now.getTime() - RECOVERY_THRESHOLDS_HOURS.recovery_3 * 60 * 60 * 1000);
    }

    // 1) Buscar organizations sin onboarded_at, no grandfathered.
    const { data: orgs, error: orgsErr } = await admin
      .from('organizations')
      .select('id, name')
      .is('onboarded_at', null)
      .eq('legacy_grandfathered', false);

    if (orgsErr) {
      console.error(`[cron/onboarding-recovery] ${kind} orgs query fail:`, orgsErr.message);
      continue;
    }

    const orgIds = (orgs ?? []).map((o) => o.id);
    if (orgIds.length === 0) continue;

    // 2) Para esas orgs, sacar el owner activo.
    const { data: owners, error: ownersErr } = await admin
      .from('memberships')
      .select('user_id, organization_id, display_name')
      .in('organization_id', orgIds)
      .eq('role', 'owner')
      .eq('active', true);

    if (ownersErr) {
      console.error(`[cron/onboarding-recovery] ${kind} owners query fail:`, ownersErr.message);
      continue;
    }

    if (!owners || owners.length === 0) continue;

    // 3) Filtrar los que ya recibieron este kind (dedup).
    const userIds = owners.map((o) => o.user_id);
    const { data: alreadySent } = await admin
      .from('onboarding_recovery_emails')
      .select('user_id')
      .eq('email_kind', kind)
      .in('user_id', userIds);

    const sentSet = new Set((alreadySent ?? []).map((r) => r.user_id));

    // 4) Para cada owner candidato, obtener email + created_at via auth admin
    //    y filtrar por la ventana del kind.
    for (const owner of owners) {
      if (sentSet.has(owner.user_id)) continue;

      const { data: userData, error: userErr } = await admin.auth.admin.getUserById(
        owner.user_id
      );
      if (userErr || !userData?.user) {
        console.error(
          `[cron/onboarding-recovery] ${kind} getUserById fail for ${owner.user_id}:`,
          userErr?.message
        );
        continue;
      }

      const user = userData.user;
      const createdAt = new Date(user.created_at);

      // Filtro de ventana:
      //   - createdAt < cutoff (suficiente tiempo pasó)
      //   - createdAt >= upperBound (no pasó el threshold del próximo kind, salvo recovery_3)
      if (createdAt >= cutoff) continue;
      if (upperBound && createdAt < upperBound) continue;

      results[kind].candidates++;

      const email = user.email ?? null;
      if (!email) {
        results[kind].skipped_no_email++;
        continue;
      }

      // Resolver nombre de la org para el template (opcional)
      const org = orgs?.find((o) => o.id === owner.organization_id);

      // 5) Enviar
      const sendResult = await sendRecoveryEmail(kind, {
        to: email,
        displayName: owner.display_name ?? null,
        orgName: org?.name ?? null,
      });

      // 6) Registrar dedup row (incluso si falló — no re-intentamos)
      const dedupRow = {
        user_id: owner.user_id,
        email_kind: kind,
        email_to: email,
        resend_message_id: sendResult.ok ? sendResult.messageId : null,
        failed_reason: sendResult.ok ? null : sendResult.error.slice(0, 500),
      };

      const { error: insErr } = await admin
        .from('onboarding_recovery_emails')
        .insert(dedupRow);

      if (insErr) {
        // Si insert falla con unique violation, otra corrida ganó. No es error.
        if (insErr.code !== '23505') {
          console.error(
            `[cron/onboarding-recovery] ${kind} insert dedup fail for ${owner.user_id}:`,
            insErr.message
          );
        }
      }

      if (sendResult.ok) {
        results[kind].sent++;
      } else {
        results[kind].failed++;
        console.error(
          `[cron/onboarding-recovery] ${kind} send fail for ${email}:`,
          sendResult.error
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: now.toISOString(),
    results,
  });
}
