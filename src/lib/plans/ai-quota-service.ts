/**
 * AIQuotaService — chequea y consume cuota de IA por suscripción.
 *
 * Modelo:
 *   - ai_usage_counters tiene 1 fila por (subscription, período).
 *   - Cada llamada a IA (skin_diagnosis o protocol) hace:
 *       1) upsert del counter del período actual (si no existe, lo crea)
 *       2) chequea plan.limits + bonus_quota vs used
 *       3) si hay cuota, incrementa atómicamente y devuelve OK
 *       4) si no hay cuota, devuelve "exhausted" — el caller muestra
 *          modal de upgrade/addon
 *   - Add-ons comprados via MP suman a bonus_quota del período actual.
 *
 * Funciones puras (computeQuotaStatus) separadas de las que tocan DB
 * para que sean fácilmente testeables.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from './definitions';
import type {
  PlanSubscription,
  AiUsageCounter,
  AiQuotaStatus,
  AddonKind,
} from './types';

// ────────────────────────────────────────────────────────────────────────────
// Pure: cálculo de status a partir de counter + plan
// ────────────────────────────────────────────────────────────────────────────

/**
 * Computa el AiQuotaStatus a partir de un counter y el plan del que sale
 * la cuota base. Función pura — útil para tests y para componentes UI que
 * ya tienen el counter en memoria.
 */
export function computeQuotaStatus(
  planId: string,
  counter: Pick<
    AiUsageCounter,
    | 'skin_diagnosis_used'
    | 'protocol_generator_used'
    | 'skin_diagnosis_bonus_quota'
    | 'protocol_generator_bonus_quota'
  >,
  kind: AddonKind,
  /** Override: si grandfathered, devolvemos cuota infinita. */
  isGrandfathered: boolean = false
): AiQuotaStatus {
  const plan = PLANS[planId as keyof typeof PLANS];

  // 3 casos:
  //   1) grandfathered → null (ilimitado, override del owner)
  //   2) plan no existe en config → 0 (cierra todo, defensivo)
  //   3) plan existe y el limit es explícitamente null → null (Centro, ilimitado)
  //   4) plan existe con número → ese número
  let planLimit: number | null;
  if (isGrandfathered) {
    planLimit = null;
  } else if (!plan) {
    planLimit = 0;
  } else {
    planLimit =
      kind === 'skin_diagnosis'
        ? plan.limits.ai_skin_diagnosis_per_month
        : plan.limits.ai_protocol_per_month;
  }

  const used = kind === 'skin_diagnosis'
    ? counter.skin_diagnosis_used
    : counter.protocol_generator_used;

  const bonus = kind === 'skin_diagnosis'
    ? counter.skin_diagnosis_bonus_quota
    : counter.protocol_generator_bonus_quota;

  // null = ilimitado (Centro o grandfathered)
  const totalAvailable = planLimit === null ? null : planLimit + bonus;
  const remaining = totalAvailable === null ? null : Math.max(0, totalAvailable - used);
  const exhausted = totalAvailable === null ? false : used >= totalAvailable;

  return {
    kind,
    plan_limit: planLimit,
    bonus,
    used,
    total_available: totalAvailable,
    remaining,
    exhausted,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// DB: upsert del counter del período actual
// ────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el counter del período en curso de la sub. Si no existe,
 * lo crea (insert) con todos los contadores en 0.
 *
 * Por qué upsert manual y no ON CONFLICT: queremos saber si lo creamos
 * para inicializar bonus_quota desde add-ons ya pagos al inicio del
 * período (caso edge: addon comprado justo antes de iniciar período).
 * Por ahora simple: solo getOrCreate sin lógica de carry-over (decisión
 * del owner: add-ons no se acumulan al siguiente período).
 */
export async function getOrCreateCurrentCounter(
  subscription: PlanSubscription
): Promise<AiUsageCounter> {
  const admin = createAdminClient();

  const { data: existing, error: selErr } = await admin
    .from('ai_usage_counters')
    .select('*')
    .eq('subscription_id', subscription.id)
    .eq('period_started_at', subscription.current_period_started_at)
    .maybeSingle();

  if (selErr) throw new Error(`select counter: ${selErr.message}`);
  if (existing) return existing as unknown as AiUsageCounter;

  const { data: created, error: insErr } = await admin
    .from('ai_usage_counters')
    .insert({
      subscription_id: subscription.id,
      period_started_at: subscription.current_period_started_at,
      period_ends_at: subscription.current_period_ends_at,
      skin_diagnosis_used: 0,
      protocol_generator_used: 0,
      skin_diagnosis_bonus_quota: 0,
      protocol_generator_bonus_quota: 0,
    })
    .select('*')
    .single();

  if (insErr) {
    // Race condition: otro request creó en paralelo. Hacemos el select de nuevo.
    const { data: retry } = await admin
      .from('ai_usage_counters')
      .select('*')
      .eq('subscription_id', subscription.id)
      .eq('period_started_at', subscription.current_period_started_at)
      .single();
    if (retry) return retry as unknown as AiUsageCounter;
    throw new Error(`crear counter: ${insErr.message}`);
  }
  return created as unknown as AiUsageCounter;
}

// ────────────────────────────────────────────────────────────────────────────
// DB: status (counter + cómputo)
// ────────────────────────────────────────────────────────────────────────────

export async function getQuotaStatus(
  subscription: PlanSubscription,
  kind: AddonKind,
  isGrandfathered: boolean = false
): Promise<AiQuotaStatus> {
  const counter = await getOrCreateCurrentCounter(subscription);
  return computeQuotaStatus(subscription.plan_id, counter, kind, isGrandfathered);
}

// ────────────────────────────────────────────────────────────────────────────
// DB: increment atómico (check + increment en una sola query)
// ────────────────────────────────────────────────────────────────────────────

export interface ConsumeQuotaResult {
  /** ¿Se pudo consumir la cuota? Si false, el caller bloquea la acción. */
  consumed: boolean;
  /** Status post-consumo (o pre-consumo si exhausted). */
  status: AiQuotaStatus;
}

/**
 * Intenta consumir 1 unidad de cuota del tipo dado.
 *
 * Atomicidad: hacemos UPDATE ... WHERE used < (limit + bonus) RETURNING.
 * Si la fila no se actualiza (porque ya estaba en el límite), devolvemos
 * consumed=false. Esto evita race conditions entre múltiples requests
 * que consultan y consumen quasi-simultáneamente.
 *
 * Si plan es ilimitado (Centro) o la org es grandfathered, NO toca DB —
 * solo devuelve consumed=true. La razón: para esas orgs no hay cuota que
 * trackear, y el counter solo sirve para mostrar UI ("usaste 145 este mes").
 * Si querés trackear igual para analytics, hay que prender una flag — por
 * ahora se ahorra escritura.
 */
export async function consumeQuota(
  subscription: PlanSubscription,
  kind: AddonKind,
  isGrandfathered: boolean = false
): Promise<ConsumeQuotaResult> {
  // Casos sin cuota: grandfathered o plan ilimitado
  if (isGrandfathered) {
    return {
      consumed: true,
      status: {
        kind,
        plan_limit: null,
        bonus: 0,
        used: 0,
        total_available: null,
        remaining: null,
        exhausted: false,
      },
    };
  }

  const counter = await getOrCreateCurrentCounter(subscription);
  const preStatus = computeQuotaStatus(subscription.plan_id, counter, kind, false);

  if (preStatus.exhausted) {
    return { consumed: false, status: preStatus };
  }

  const admin = createAdminClient();
  const limit = preStatus.total_available;
  if (limit === null) {
    // No debería pasar (preStatus.exhausted=false ya cubrió ilimitado), pero defensivo
    return { consumed: true, status: preStatus };
  }

  // UPDATE con guarda de límite. PostgREST no expone CHECK constraints
  // condicionales, así que filtramos por used < limit en el WHERE.
  // Branches explícitos para que TS narrow correctamente la columna a updatear.
  const newUsed = preStatus.used + 1;
  const updateQuery =
    kind === 'skin_diagnosis'
      ? admin
          .from('ai_usage_counters')
          .update({ skin_diagnosis_used: newUsed })
          .eq('id', counter.id)
          .lt('skin_diagnosis_used', limit)
      : admin
          .from('ai_usage_counters')
          .update({ protocol_generator_used: newUsed })
          .eq('id', counter.id)
          .lt('protocol_generator_used', limit);
  const { data, error } = await updateQuery.select('*').maybeSingle();

  if (error) throw new Error(`incrementar counter: ${error.message}`);
  if (!data) {
    // Race: otro request consumió justo antes. Re-fetch y reportar exhausted.
    const fresh = await getOrCreateCurrentCounter(subscription);
    return {
      consumed: false,
      status: computeQuotaStatus(subscription.plan_id, fresh, kind, false),
    };
  }

  return {
    consumed: true,
    status: computeQuotaStatus(
      subscription.plan_id,
      data as unknown as AiUsageCounter,
      kind,
      false
    ),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// DB: aplicar add-on comprado (post-webhook MP)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Aplica un add-on al counter del período actual: suma `quantity` al
 * `bonus_quota` correspondiente. Marca la fila de ai_addon_purchases
 * como `paid` con `applied_to_period_*`.
 *
 * Llamado por el webhook de MP al confirmar el cobro del add-on.
 */
export async function applyAddonPurchase(addonPurchaseId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: addon, error: addonErr } = await admin
    .from('ai_addon_purchases')
    .select('*, plan_subscriptions(*)')
    .eq('id', addonPurchaseId)
    .single();
  if (addonErr) throw new Error(`fetch addon: ${addonErr.message}`);
  if (addon.status === 'paid') return; // ya aplicado, idempotente

  const sub = addon.plan_subscriptions as unknown as PlanSubscription;
  const counter = await getOrCreateCurrentCounter(sub);

  // Decidir a qué counter sumar según addon_type (branches explícitos para TS)
  const kind: AddonKind = addon.addon_type.startsWith('skin_diagnosis')
    ? 'skin_diagnosis'
    : 'protocol';

  if (kind === 'skin_diagnosis') {
    const newBonus = counter.skin_diagnosis_bonus_quota + addon.quantity_added;
    await admin
      .from('ai_usage_counters')
      .update({ skin_diagnosis_bonus_quota: newBonus })
      .eq('id', counter.id);
  } else {
    const newBonus = counter.protocol_generator_bonus_quota + addon.quantity_added;
    await admin
      .from('ai_usage_counters')
      .update({ protocol_generator_bonus_quota: newBonus })
      .eq('id', counter.id);
  }

  const now = new Date().toISOString();
  await admin
    .from('ai_addon_purchases')
    .update({
      status: 'paid',
      paid_at: now,
      applied_to_period_start: sub.current_period_started_at,
      applied_to_period_end: sub.current_period_ends_at,
    })
    .eq('id', addonPurchaseId);
}
