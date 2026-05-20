/**
 * POST /api/subscriptions/upgrade
 *
 * Body: { to_plan_id: 'gabinete' | 'equipo' }
 *
 * Flujo:
 *   1) Auth (solo owner puede cambiar plan)
 *   2) Llama a SubscriptionService.changePlan
 *   3) Si fue UPGRADE inmediato con charge_amount > 0:
 *        - Crea preference de Checkout Pro de MP por el monto del diff
 *        - Devuelve { init_point } para que la UI redirija al checkout
 *        - Cuando MP confirme via webhook, la saas_invoice pasa a 'paid'
 *   4) Si fue DOWNGRADE diferido o cambio sin cobro:
 *        - Devuelve { ok: true, scheduled: true }
 *        - El cron diario aplica el cambio al fin del período
 *
 * Si MP no está configurado y hay charge:
 *   - El upgrade YA se aplicó en plan_subscriptions (changePlan lo hizo)
 *   - La saas_invoice quedó como 'pending' sin manera de cobrar
 *   - Devolvemos warning para que el frontend muestre "MP no configurado,
 *     contactar soporte para que active tu plan nuevo"
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { changePlan } from '@/lib/plans/subscription-service';
import { createCheckoutPreference } from '@/lib/integrations/mp-saas/checkout-pro';
import { isMpConfigured } from '@/lib/integrations/mp-saas/client';
import { PLANS } from '@/lib/plans/definitions';
import { audit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PlanId } from '@/lib/plans/types';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

export async function POST(req: NextRequest) {
  const { orgId, userId } = await requireMembership({ minRole: 'owner' });

  let body: { to_plan_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const toPlanId = body.to_plan_id as PlanId;
  if (!toPlanId || !PLANS[toPlanId] || !PLANS[toPlanId].available_in_ui) {
    return NextResponse.json({ error: 'Plan no disponible' }, { status: 400 });
  }

  let result;
  try {
    result = await changePlan({ orgId, userId, toPlanId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await audit({
    organizationId: orgId,
    action:
      result.kind === 'upgrade_applied'
        ? 'subscription.upgrade'
        : result.kind === 'downgrade_scheduled'
          ? 'subscription.downgrade_scheduled'
          : 'subscription.plan_change_noop',
    entityType: 'subscription',
    entityId: result.subscription.id,
    payload: {
      from_plan: result.subscription.plan_id,
      to_plan: toPlanId,
      charge: result.chargedAmount,
    },
  });

  // No-op o downgrade diferido: ya está, no hay cobro
  if (result.kind === 'no_change' || result.kind === 'downgrade_scheduled') {
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      subscription: result.subscription,
      effective_at:
        result.kind === 'downgrade_scheduled'
          ? result.subscription.current_period_ends_at
          : null,
    });
  }

  // Upgrade inmediato con charge_amount > 0 → crear Checkout Pro
  if (result.chargedAmount === 0) {
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      subscription: result.subscription,
      checkout: null,
    });
  }

  if (!isMpConfigured()) {
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      subscription: result.subscription,
      warning: 'Plan actualizado, pero MP de appestetika no está configurado. Contactá soporte para regularizar el cobro.',
    });
  }

  // Crear Checkout Pro por el diff
  const planDef = PLANS[toPlanId];
  const admin = createAdminClient();
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();
  const orgName = org?.name ?? 'tu centro';

  try {
    const preference = await createCheckoutPreference({
      items: [
        {
          title: `Upgrade a ${planDef.name} — ${orgName}`,
          description: `Diferencia por upgrade desde el plan anterior`,
          quantity: 1,
          unit_price: result.chargedAmount,
        },
      ],
      external_reference: result.invoiceId!, // saas_invoice.id
      success_url: `${APP_URL}/configuracion?ok=upgrade-pagado`,
      failure_url: `${APP_URL}/configuracion?error=upgrade-pago-fallido`,
      back_url: `${APP_URL}/configuracion`,
      metadata: {
        invoice_id: result.invoiceId!,
        subscription_id: result.subscription.id,
        kind: 'upgrade_diff',
      },
    });

    return NextResponse.json({
      ok: true,
      kind: result.kind,
      subscription: result.subscription,
      checkout: {
        init_point: preference.init_point,
        preference_id: preference.id,
      },
    });
  } catch (err) {
    console.error('[upgrade] createCheckoutPreference fail:', err);
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      subscription: result.subscription,
      warning: 'Plan actualizado, pero no pudimos generar el link de pago. Contactá soporte.',
    });
  }
}
