'use server';

/**
 * Server actions del sistema de suscripciones.
 *
 * Patrón: validar auth + rol con requireMembership, después llamar al
 * service layer. Las páginas/forms del panel invocan estas funciones
 * directamente vía `<form action={cancelSubscriptionAction}>`.
 *
 * Para operaciones que necesitan devolver una URL (ej. redirect a MP
 * Checkout Pro), usar route handlers en `src/app/api/subscriptions/`.
 * Acá solo van las que cambian estado y redirigen dentro del panel.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireMembership } from '@/lib/auth/require-membership';
import {
  cancelSubscription as serviceCancelSubscription,
  reactivateSubscription as serviceReactivateSubscription,
  createTrialSubscription,
  getActiveSubscription,
} from '@/lib/plans/subscription-service';
import { audit } from '@/lib/audit';
import type { PlanId, BillingCycle } from '@/lib/plans/types';
import { PLANS } from '@/lib/plans/definitions';
import { cancelPreapproval } from '@/lib/integrations/mp-saas/preapproval';
import { isMpConfigured } from '@/lib/integrations/mp-saas/client';

// ────────────────────────────────────────────────────────────────────────────
// selectInitialPlan — del paso 1 del onboarding (decisión 1C)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Crea la subscription en estado trialing al elegir plan en el onboarding.
 * Solo permite ejecutar si la org NO tiene ya una sub viva.
 */
export async function selectInitialPlanAction(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireMembership({ minRole: 'owner' });

  const planId = String(formData.get('plan_id') ?? '') as PlanId;
  const billingCycle = (String(formData.get('billing_cycle') ?? 'monthly') as BillingCycle);

  if (!['gabinete', 'equipo'].includes(planId)) {
    redirect('/onboarding?error=Plan+inv%C3%A1lido');
  }
  if (!['monthly', 'yearly'].includes(billingCycle)) {
    redirect('/onboarding?error=Ciclo+inv%C3%A1lido');
  }

  // Defensa anti-doble-click / race: si ya hay sub viva, no creamos otra.
  const existing = await getActiveSubscription(orgId);
  if (existing) {
    // Ya elegiste, seguí con el onboarding
    redirect('/onboarding/presencia');
  }

  try {
    await createTrialSubscription({
      organizationId: orgId,
      planId,
      billingCycle,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    redirect(`/onboarding?error=${encodeURIComponent(msg)}`);
  }

  await audit({
    organizationId: orgId,
    action: 'subscription.trial_start',
    entityType: 'subscription',
    entityId: orgId,
    payload: { plan_id: planId, billing_cycle: billingCycle, userId },
  });

  // Meta Pixel: trackeamos StartTrial al fin del embudo de adquisición.
  // Pasamos el valor (predicted_ltv aproximado = precio mensual del plan,
  // sirve a Meta para optimizar campañas de ads que buscan trials valiosos)
  // y el plan elegido.
  const planDef = PLANS[planId];
  const value = planDef?.price_monthly_ars ?? 0;
  const trialQs = `fbq_started_trial=1&fbq_value=${value}&fbq_plan=${encodeURIComponent(planId)}`;

  // Siguiente paso del onboarding (presencia online: slug, horarios, etc.)
  redirect(`/onboarding/presencia?${trialQs}`);
}

// ────────────────────────────────────────────────────────────────────────────
// cancelSubscriptionAction
// ────────────────────────────────────────────────────────────────────────────

export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireMembership({ minRole: 'owner' });
  const reason = String(formData.get('reason') ?? '').trim() || null;

  const sub = await getActiveSubscription(orgId);
  if (!sub) {
    redirect('/configuracion?error=No+hay+suscripci%C3%B3n+activa');
  }

  try {
    await serviceCancelSubscription(orgId, userId, reason ?? undefined);

    // Si tenía preapproval de MP (cobro mensual recurrente), cancelarlo
    // también — sino seguiría intentando debitar.
    if (sub.mp_preapproval_id && isMpConfigured()) {
      try {
        await cancelPreapproval(sub.mp_preapproval_id);
      } catch (err) {
        // No bloquear el cancel local si MP falla — log para soporte.
        console.error('[cancel] cancelPreapproval falló:', err);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    redirect(`/configuracion?error=${encodeURIComponent(msg)}`);
  }

  await audit({
    organizationId: orgId,
    action: 'subscription.cancel',
    entityType: 'subscription',
    entityId: sub.id,
    payload: { reason },
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=suscripcion-cancelada');
}

// ────────────────────────────────────────────────────────────────────────────
// reactivateSubscriptionAction
// ────────────────────────────────────────────────────────────────────────────

export async function reactivateSubscriptionAction(): Promise<void> {
  const { orgId, userId } = await requireMembership({ minRole: 'owner' });

  try {
    await serviceReactivateSubscription(orgId, userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    redirect(`/configuracion?error=${encodeURIComponent(msg)}`);
  }

  await audit({
    organizationId: orgId,
    action: 'subscription.reactivate',
    entityType: 'subscription',
    entityId: orgId,
  });

  revalidatePath('/configuracion');
  redirect('/configuracion?ok=suscripcion-reactivada');
}
