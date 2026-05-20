/**
 * GET /api/subscriptions/me
 *
 * Estado actual de la suscripción de la org activa del user, + cuota IA
 * del período en curso. Sirve para hidratar:
 *   - Badge "trial restante X días" en el dashboard
 *   - Página /configuracion sección "Mi plan"
 *   - Widget de cuota IA en /ia
 *
 * Auth: cualquier miembro de la org (no solo owner) puede leer.
 */

import { NextResponse } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { getOrgFeatureContext } from '@/lib/plans/subscription-service';
import {
  computeQuotaStatus,
  getOrCreateCurrentCounter,
} from '@/lib/plans/ai-quota-service';
import { PLANS } from '@/lib/plans/definitions';

export const runtime = 'nodejs';

export async function GET() {
  const { orgId } = await requireMembership();

  const { subscription, isGrandfathered } = await getOrgFeatureContext(orgId);

  if (!subscription) {
    return NextResponse.json({
      subscription: null,
      grandfathered: isGrandfathered,
      plan: null,
      ai_quota: null,
    });
  }

  // Para no bloquear si el counter no existe todavía, lo creamos (idempotente)
  let counter = null;
  let skinQuota = null;
  let protocolQuota = null;
  try {
    counter = await getOrCreateCurrentCounter(subscription);
    skinQuota = computeQuotaStatus(
      subscription.plan_id,
      counter,
      'skin_diagnosis',
      isGrandfathered
    );
    protocolQuota = computeQuotaStatus(
      subscription.plan_id,
      counter,
      'protocol',
      isGrandfathered
    );
  } catch (err) {
    console.error('[/api/subscriptions/me] counter fail:', err);
  }

  const planDef = PLANS[subscription.plan_id];

  return NextResponse.json({
    subscription,
    grandfathered: isGrandfathered,
    plan: planDef
      ? {
          id: planDef.id,
          name: planDef.name,
          tagline: planDef.tagline,
          price_monthly_ars: planDef.price_monthly_ars,
          price_yearly_ars: planDef.price_yearly_ars,
          limits: planDef.limits,
          features: planDef.features,
        }
      : null,
    ai_quota:
      counter && skinQuota && protocolQuota
        ? {
            period_started_at: counter.period_started_at,
            period_ends_at: counter.period_ends_at,
            skin_diagnosis: skinQuota,
            protocol: protocolQuota,
          }
        : null,
  });
}
