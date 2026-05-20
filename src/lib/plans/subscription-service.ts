/**
 * SubscriptionService — orquesta el ciclo de vida de las suscripciones.
 *
 * No valida permisos (lo hace el caller con requireMembership). Acepta
 * un admin client de Supabase porque escribe a tablas RLS-restricted
 * (plan_subscriptions, plan_change_events, saas_invoices).
 *
 * El patrón: los server actions / API handlers validan auth y rol,
 * después llaman a estas funciones. La service-layer asume que el caller
 * ya verificó que el user tiene derecho a hacer lo que pide.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  PLANS,
  TRIAL_DAYS,
  type BillingCycle,
  type PlanId,
} from './definitions';
import type { PlanSubscription, SubscriptionStatus } from './types';
import {
  getNextPeriodEnd,
  getTrialEndDate,
  getUpgradeChargeAmount,
  isUpgrade,
  isDowngrade,
} from './billing-calculations';

/** Snapshot serializable de una subscription. */
function rowToSubscription(row: Record<string, unknown>): PlanSubscription {
  return row as unknown as PlanSubscription;
}

// ────────────────────────────────────────────────────────────────────────────
// Lecturas
// ────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la subscription "viva" de una org (trialing/active/past_due/
 * suspended/trial_expired). Null si no hay ninguna (org sin sub creada).
 */
export async function getActiveSubscription(
  orgId: string
): Promise<PlanSubscription | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('plan_subscriptions')
    .select('*')
    .eq('organization_id', orgId)
    .in('status', ['trialing', 'active', 'past_due', 'suspended', 'trial_expired'])
    .maybeSingle();

  if (error) throw new Error(`getActiveSubscription falló: ${error.message}`);
  return data ? rowToSubscription(data) : null;
}

/**
 * Como getActiveSubscription pero también devuelve `legacy_grandfathered`
 * de la org. Atajo para alimentar `FeatureContext`.
 */
export async function getOrgFeatureContext(
  orgId: string
): Promise<{
  subscription: PlanSubscription | null;
  isGrandfathered: boolean;
}> {
  const admin = createAdminClient();
  const [subRes, orgRes] = await Promise.all([
    admin
      .from('plan_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['trialing', 'active', 'past_due', 'suspended', 'trial_expired'])
      .maybeSingle(),
    admin
      .from('organizations')
      .select('legacy_grandfathered')
      .eq('id', orgId)
      .single(),
  ]);

  if (subRes.error) throw new Error(`subscription query: ${subRes.error.message}`);
  if (orgRes.error) throw new Error(`org query: ${orgRes.error.message}`);

  return {
    subscription: subRes.data ? rowToSubscription(subRes.data) : null,
    isGrandfathered: orgRes.data?.legacy_grandfathered === true,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Creación al onboarding (decisión 1C: trial empieza al elegir plan)
// ────────────────────────────────────────────────────────────────────────────

export interface CreateTrialParams {
  organizationId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  /** Fecha de "ahora" inyectable para tests. Default Date(). */
  now?: Date;
}

/**
 * Crea una sub en estado 'trialing' al elegir plan en el onboarding.
 * Si ya hay una sub viva para la org (ej. otro miembro la creó en paralelo),
 * lanza error — el caller debe usar `getActiveSubscription` antes para
 * evitar la race.
 */
export async function createTrialSubscription(
  params: CreateTrialParams
): Promise<PlanSubscription> {
  const admin = createAdminClient();
  const now = params.now ?? new Date();

  if (!PLANS[params.planId]?.available_in_ui && params.planId !== 'centro') {
    throw new Error(`Plan ${params.planId} no disponible para checkout.`);
  }

  const trialEnd = getTrialEndDate(now, TRIAL_DAYS);
  // current_period_* refleja el período de "este trial". Si paga, lo
  // extendemos al primer ciclo facturado. Sino, pasamos a trial_expired
  // en current_period_ends_at.

  const externalRef = `trial_${params.organizationId}_${now.getTime()}`;

  const { data, error } = await admin
    .from('plan_subscriptions')
    .insert({
      organization_id: params.organizationId,
      plan_id: params.planId,
      billing_cycle: params.billingCycle,
      status: 'trialing' as SubscriptionStatus,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      current_period_started_at: now.toISOString(),
      current_period_ends_at: trialEnd.toISOString(),
      cancel_at_period_end: false,
      mp_external_reference: externalRef,
    })
    .select('*')
    .single();

  if (error) {
    // Posible unique violation del partial index si ya hay una sub viva
    throw new Error(`createTrialSubscription falló: ${error.message}`);
  }
  return rowToSubscription(data);
}

// ────────────────────────────────────────────────────────────────────────────
// Cancelar / reactivar (cancel sigue vigente hasta fin del período)
// ────────────────────────────────────────────────────────────────────────────

export async function cancelSubscription(
  orgId: string,
  userId: string,
  reason?: string
): Promise<PlanSubscription> {
  const admin = createAdminClient();
  const current = await getActiveSubscription(orgId);
  if (!current) throw new Error('No hay sub activa para cancelar.');
  if (current.status === 'cancelled' || current.status === 'expired') {
    throw new Error(`Sub ya está ${current.status}.`);
  }

  // status='cancelled' = canceló pero el período pagado sigue vigente.
  // Al expirar el período un cron la pasa a 'expired'.
  const { data, error } = await admin
    .from('plan_subscriptions')
    .update({
      status: 'cancelled' as SubscriptionStatus,
      cancel_at_period_end: true,
    })
    .eq('id', current.id)
    .select('*')
    .single();

  if (error) throw new Error(`cancelSubscription falló: ${error.message}`);

  // Audit
  await admin.from('plan_change_events').insert({
    subscription_id: current.id,
    from_plan: current.plan_id,
    to_plan: current.plan_id,
    from_billing_cycle: current.billing_cycle,
    to_billing_cycle: current.billing_cycle,
    effective_at: current.current_period_ends_at,
    applied_at: null, // será procesado cuando llegue effective_at
    triggered_by_user_id: userId,
    reason: reason ?? 'Cancelación por el usuario',
  });

  return rowToSubscription(data);
}

export async function reactivateSubscription(
  orgId: string,
  userId: string
): Promise<PlanSubscription> {
  const admin = createAdminClient();
  const current = await getActiveSubscription(orgId);
  if (!current) throw new Error('No hay sub para reactivar.');
  if (current.status !== 'cancelled') {
    throw new Error(`Sub no está cancelada (status: ${current.status}).`);
  }

  const { data, error } = await admin
    .from('plan_subscriptions')
    .update({
      status: 'active' as SubscriptionStatus,
      cancel_at_period_end: false,
    })
    .eq('id', current.id)
    .select('*')
    .single();
  if (error) throw new Error(`reactivateSubscription falló: ${error.message}`);

  await admin.from('plan_change_events').insert({
    subscription_id: current.id,
    from_plan: current.plan_id,
    to_plan: current.plan_id,
    effective_at: new Date().toISOString(),
    applied_at: new Date().toISOString(),
    triggered_by_user_id: userId,
    reason: 'Reactivación post-cancelación',
  });

  return rowToSubscription(data);
}

// ────────────────────────────────────────────────────────────────────────────
// Cambio de plan (decisión 7A: upgrade flat / downgrade diferido)
// ────────────────────────────────────────────────────────────────────────────

export interface ChangePlanResult {
  /** Sub después del cambio (mismo objeto si downgrade diferido). */
  subscription: PlanSubscription;
  /** Tipo de cambio aplicado. */
  kind: 'upgrade_applied' | 'downgrade_scheduled' | 'no_change';
  /** Cuánto se cobró ya (upgrade) — 0 si no es upgrade. */
  chargedAmount: number;
  /** ID de la factura del upgrade si aplica. */
  invoiceId?: string;
  /** ID del evento programado si es downgrade. */
  scheduledEventId?: string;
}

/**
 * Cambia el plan de la sub activa.
 *
 *   Upgrade (gabinete → equipo):
 *     - Inmediato. Actualiza plan_id y bumpea la cuota IA (próximo período
 *       o regla "se ve ya" según implementación de AIQuotaService).
 *     - Cobra la diferencia plana via saas_invoices (kind='upgrade_diff').
 *     - El billing_cycle queda igual; el próximo cobro normal será al
 *       precio del plan nuevo.
 *
 *   Downgrade (equipo → gabinete):
 *     - Se aplica al fin del período actual. Crea plan_change_event con
 *       applied_at=null + effective_at=current_period_ends_at.
 *     - processDeferredChanges() lo aplica en su momento.
 *
 *   Mismo plan o cambio a uno no disponible: no_change.
 */
export async function changePlan(params: {
  orgId: string;
  userId: string;
  toPlanId: PlanId;
}): Promise<ChangePlanResult> {
  const { orgId, userId, toPlanId } = params;
  const admin = createAdminClient();
  const current = await getActiveSubscription(orgId);
  if (!current) throw new Error('No hay sub activa para cambiar plan.');
  if (current.status === 'suspended' || current.status === 'expired') {
    throw new Error('No se puede cambiar plan con sub suspendida o expirada.');
  }

  // No-op
  if (current.plan_id === toPlanId) {
    return {
      subscription: current,
      kind: 'no_change',
      chargedAmount: 0,
    };
  }

  // Upgrade inmediato
  if (isUpgrade(current.plan_id, toPlanId)) {
    const chargeAmount = getUpgradeChargeAmount(
      current.plan_id,
      toPlanId,
      current.billing_cycle
    );

    // 1) Factura del diff (status pending; webhook MP la marca paid después).
    const externalRef = `upgrade_${current.id}_${Date.now()}`;
    const { data: invoice, error: invErr } = await admin
      .from('saas_invoices')
      .insert({
        subscription_id: current.id,
        amount_ars: chargeAmount,
        billing_period_start: current.current_period_started_at,
        billing_period_end: current.current_period_ends_at,
        invoice_kind: 'upgrade_diff',
        status: chargeAmount > 0 ? 'pending' : 'paid',
        mp_external_reference: externalRef,
      })
      .select('id')
      .single();
    if (invErr) throw new Error(`crear invoice upgrade: ${invErr.message}`);

    // 2) Actualizar plan inmediatamente.
    const { data: updated, error: updErr } = await admin
      .from('plan_subscriptions')
      .update({ plan_id: toPlanId })
      .eq('id', current.id)
      .select('*')
      .single();
    if (updErr) throw new Error(`actualizar plan: ${updErr.message}`);

    // 3) Audit del cambio.
    const { data: event, error: evErr } = await admin
      .from('plan_change_events')
      .insert({
        subscription_id: current.id,
        from_plan: current.plan_id,
        to_plan: toPlanId,
        from_billing_cycle: current.billing_cycle,
        to_billing_cycle: current.billing_cycle,
        effective_at: new Date().toISOString(),
        applied_at: new Date().toISOString(),
        charge_amount_ars: chargeAmount,
        saas_invoice_id: invoice.id,
        triggered_by_user_id: userId,
        reason: `Upgrade ${current.plan_id} → ${toPlanId}`,
      })
      .select('id')
      .single();
    if (evErr) throw new Error(`crear event: ${evErr.message}`);

    return {
      subscription: rowToSubscription(updated),
      kind: 'upgrade_applied',
      chargedAmount: chargeAmount,
      invoiceId: invoice.id,
      scheduledEventId: event.id,
    };
  }

  // Downgrade diferido
  if (isDowngrade(current.plan_id, toPlanId)) {
    const { data: event, error: evErr } = await admin
      .from('plan_change_events')
      .insert({
        subscription_id: current.id,
        from_plan: current.plan_id,
        to_plan: toPlanId,
        from_billing_cycle: current.billing_cycle,
        to_billing_cycle: current.billing_cycle,
        effective_at: current.current_period_ends_at,
        applied_at: null,
        triggered_by_user_id: userId,
        reason: `Downgrade ${current.plan_id} → ${toPlanId} (efectivo al fin del período)`,
      })
      .select('id')
      .single();
    if (evErr) throw new Error(`crear downgrade event: ${evErr.message}`);

    return {
      subscription: current,
      kind: 'downgrade_scheduled',
      chargedAmount: 0,
      scheduledEventId: event.id,
    };
  }

  // No debería llegar acá pero por completitud
  return { subscription: current, kind: 'no_change', chargedAmount: 0 };
}

// ────────────────────────────────────────────────────────────────────────────
// Cron de cambios diferidos
// ────────────────────────────────────────────────────────────────────────────

/**
 * Procesa todos los plan_change_events pendientes (applied_at IS NULL)
 * cuyo effective_at ya pasó. Aplica el cambio y marca applied_at=now.
 *
 * Lo llama un cron diario. Idempotente: si lo corremos 2 veces en el
 * mismo día no pasa nada (el filtro `applied_at IS NULL` excluye los ya
 * procesados).
 *
 * Devuelve los IDs procesados para log.
 */
export async function processDeferredChanges(now: Date = new Date()): Promise<string[]> {
  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from('plan_change_events')
    .select('*')
    .is('applied_at', null)
    .lte('effective_at', now.toISOString());
  if (error) throw new Error(`fetch pending events: ${error.message}`);

  const processed: string[] = [];
  for (const ev of pending ?? []) {
    // Si es solo audit de cancelación (from_plan === to_plan + cancel),
    // significa "marca como expired al llegar effective_at".
    const isCancellation = ev.from_plan === ev.to_plan;

    if (isCancellation) {
      await admin
        .from('plan_subscriptions')
        .update({ status: 'expired' as SubscriptionStatus })
        .eq('id', ev.subscription_id);
    } else {
      // Downgrade: actualiza plan al toPlan, mantiene fechas del período.
      await admin
        .from('plan_subscriptions')
        .update({ plan_id: ev.to_plan })
        .eq('id', ev.subscription_id);
    }

    await admin
      .from('plan_change_events')
      .update({ applied_at: now.toISOString() })
      .eq('id', ev.id);

    processed.push(ev.id);
  }
  return processed;
}

// ────────────────────────────────────────────────────────────────────────────
// Renovaciones / cobros (consumido por webhooks MP en capa 3)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Marca pago exitoso: extiende current_period_* al siguiente ciclo y pone
 * status='active'. Llamado por el webhook de MP cuando confirma un cobro.
 */
export async function markPaymentSucceeded(
  subscriptionId: string,
  mpPaymentId: string,
  invoiceId: string,
  now: Date = new Date()
): Promise<void> {
  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from('plan_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();
  if (subErr) throw new Error(`fetch sub: ${subErr.message}`);

  // 1) marca invoice paid
  await admin
    .from('saas_invoices')
    .update({
      status: 'paid',
      paid_at: now.toISOString(),
      mp_payment_id: mpPaymentId,
    })
    .eq('id', invoiceId);

  // 2) extiende período
  const newPeriodStart = new Date(sub.current_period_ends_at);
  const newPeriodEnd = getNextPeriodEnd(newPeriodStart, sub.billing_cycle);

  await admin
    .from('plan_subscriptions')
    .update({
      status: 'active',
      current_period_started_at: newPeriodStart.toISOString(),
      current_period_ends_at: newPeriodEnd.toISOString(),
    })
    .eq('id', subscriptionId);
}

/**
 * Marca cobro fallido. Si era el primero, status='past_due' + schedule
 * de retries. Si era el último retry, status='suspended'.
 */
export async function markPaymentFailed(
  subscriptionId: string,
  invoiceId: string,
  reason: string,
  now: Date = new Date()
): Promise<void> {
  const admin = createAdminClient();

  const { data: invoice, error: invErr } = await admin
    .from('saas_invoices')
    .select('attempts')
    .eq('id', invoiceId)
    .single();
  if (invErr) throw new Error(`fetch invoice: ${invErr.message}`);

  const newAttempts = (invoice.attempts ?? 0) + 1;
  const MAX_ATTEMPTS = 3;

  if (newAttempts >= MAX_ATTEMPTS) {
    // Suspendemos
    await admin
      .from('saas_invoices')
      .update({
        status: 'failed',
        failed_at: now.toISOString(),
        failed_reason: reason,
        attempts: newAttempts,
        next_retry_at: null,
      })
      .eq('id', invoiceId);

    await admin
      .from('plan_subscriptions')
      .update({ status: 'suspended' })
      .eq('id', subscriptionId);
  } else {
    // Schedule next retry. RETRY_SCHEDULE_DAYS = [2, 4, 7] (días desde el
    // PRIMER intento, no entre intentos). Como guardamos attempts, el
    // próximo intento es RETRY_SCHEDULE_DAYS[attempts-1] días desde ahora.
    // Simplificamos a "intentos cada 2-3 días" porque MP igual hace sus
    // propios reintentos internos.
    const nextRetry = new Date(now);
    nextRetry.setUTCDate(nextRetry.getUTCDate() + 2);

    await admin
      .from('saas_invoices')
      .update({
        attempts: newAttempts,
        next_retry_at: nextRetry.toISOString(),
        failed_reason: reason,
      })
      .eq('id', invoiceId);

    await admin
      .from('plan_subscriptions')
      .update({ status: 'past_due' })
      .eq('id', subscriptionId);
  }
}
