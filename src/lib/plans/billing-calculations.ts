/**
 * Math puro de facturación: rankeo de planes, cálculo de upgrades,
 * cálculo de fin de período. Sin DB, sin side effects.
 *
 * Por qué separado del SubscriptionService: estos cálculos son fácilmente
 * testeables sin mockear nada, y son el "núcleo de negocio" de cualquier
 * cambio de plan. Si esto está bien, el resto del servicio es plomería.
 */

import {
  PLANS,
  type BillingCycle,
  type PlanId,
} from './definitions';

// ────────────────────────────────────────────────────────────────────────────
// Ranking — para decidir upgrade vs downgrade
// ────────────────────────────────────────────────────────────────────────────

const PLAN_RANK: Record<PlanId, number> = {
  gabinete: 1,
  equipo: 2,
  centro: 3,
};

export function getPlanRank(planId: PlanId): number {
  return PLAN_RANK[planId] ?? 0;
}

/** True si toPlan es mayor rank que fromPlan. */
export function isUpgrade(fromPlan: PlanId, toPlan: PlanId): boolean {
  return getPlanRank(toPlan) > getPlanRank(fromPlan);
}

/** True si toPlan es menor rank que fromPlan. */
export function isDowngrade(fromPlan: PlanId, toPlan: PlanId): boolean {
  return getPlanRank(toPlan) < getPlanRank(fromPlan);
}

// ────────────────────────────────────────────────────────────────────────────
// Costo de upgrade (decisión 7A: diferencia plana)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cuánto cobramos al hacer upgrade inmediato.
 *
 * Decisión 7A del owner: cobramos la diferencia PLANA entre el precio
 * mensual de ambos planes, sin prorratear por días restantes. Si pasa de
 * Gabinete ($29.990) a Equipo ($54.990), siempre $25.000, sea día 5 o
 * día 25 del mes. Más simple de explicar, asume que el cliente está OK
 * pagando "el extra de empezar a usar lo nuevo".
 *
 * En billing-cycle 'yearly' aplicamos la misma lógica con precios anuales.
 *
 * Si NO es upgrade (toPlan == fromPlan o downgrade), devuelve 0.
 */
export function getUpgradeChargeAmount(
  fromPlan: PlanId,
  toPlan: PlanId,
  billingCycle: BillingCycle
): number {
  if (!isUpgrade(fromPlan, toPlan)) return 0;

  const fromDef = PLANS[fromPlan];
  const toDef = PLANS[toPlan];
  if (!fromDef || !toDef) return 0;

  if (billingCycle === 'yearly') {
    return Math.max(0, toDef.price_yearly_ars - fromDef.price_yearly_ars);
  }
  return Math.max(0, toDef.price_monthly_ars - fromDef.price_monthly_ars);
}

// ────────────────────────────────────────────────────────────────────────────
// Fechas de período
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el fin del período dado un inicio + ciclo de facturación.
 *
 * Comportamiento mes a mes: suma 1 mes con clamp al último día válido. Si
 * el inicio es 31 de enero y se suma 1 mes, queda 28/29 de febrero (no se
 * desborda a marzo).
 *
 * Para 'yearly' suma 1 año con la misma lógica (29 feb año bisiesto → 28
 * feb año siguiente).
 */
export function getNextPeriodEnd(startedAt: Date, billingCycle: BillingCycle): Date {
  const result = new Date(startedAt);
  if (billingCycle === 'monthly') {
    addMonthsClamped(result, 1);
  } else {
    // yearly: 12 meses con clamp también cubre 29/feb correctamente
    addMonthsClamped(result, 12);
  }
  return result;
}

/**
 * Suma `months` meses a una fecha sin "desbordarse" al mes siguiente.
 * Ej: 31-Ene + 1 mes = 28-Feb (no 3-Mar como hace Date.setMonth() raw).
 * Muta el Date pasado.
 */
function addMonthsClamped(d: Date, months: number): void {
  const targetMonth = d.getUTCMonth() + months;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const monthIndex = ((targetMonth % 12) + 12) % 12;
  const day = d.getUTCDate();

  // Día último válido del mes objetivo (UTC para evitar drama de TZ)
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  d.setUTCFullYear(targetYear, monthIndex, clampedDay);
}

// ────────────────────────────────────────────────────────────────────────────
// Trial
// ────────────────────────────────────────────────────────────────────────────

/** Fin del trial dado el inicio (TRIAL_DAYS días después). */
export function getTrialEndDate(startedAt: Date, trialDays: number): Date {
  const d = new Date(startedAt);
  d.setUTCDate(d.getUTCDate() + trialDays);
  return d;
}
