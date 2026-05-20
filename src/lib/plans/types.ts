/**
 * Tipos TypeScript que reflejan las tablas DB del sistema de planes.
 * Estos tipos son la "vista" que la app tiene de las filas — no son los
 * tipos generados automáticamente desde Supabase (esos viven en
 * `src/types/database.ts`).
 *
 * Importar desde acá en server actions y componentes para tener tipos
 * estables que no cambien si renombramos columnas en la DB.
 */

import type { PlanId, BillingCycle } from './definitions';
export type { PlanId, BillingCycle, FeatureFlag, AddonId, AddonKind } from './definitions';

// ────────────────────────────────────────────────────────────────────────────
// Subscription
// ────────────────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  /** Dentro de los 30 días gratis del plan elegido. Acceso completo al plan. */
  | 'trialing'
  /** Pagando OK. Acceso completo al plan. */
  | 'active'
  /** Último cobro mensual falló. En gracia (hasta 7 días), retry policy corriendo. */
  | 'past_due'
  /** Sin pago tras la gracia. Read-only hasta resolver. */
  | 'suspended'
  /** Trial venció sin método de pago. Read-only por 15 días, después archivar. */
  | 'trial_expired'
  /** Canceló pero el período pagado sigue vigente — al cumplirse pasa a 'expired'. */
  | 'cancelled'
  /** Período pagado terminó sin renovar. */
  | 'expired';

export interface PlanSubscription {
  id: string;
  organization_id: string;
  plan_id: PlanId;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;

  /** Inicio del trial. Null si nunca tuvo trial (ej. legacy grandfathered). */
  trial_started_at: string | null;
  /** Fin del trial. Null si nunca tuvo trial. */
  trial_ends_at: string | null;

  /** Inicio del período de facturación actual. */
  current_period_started_at: string;
  /** Fin del período. Para legacy grandfathered es 9999-12-31. */
  current_period_ends_at: string;

  /**
   * Si true, cuando llegue `current_period_ends_at` la sub pasa a 'expired'.
   * Lo setea el endpoint de cancel.
   */
  cancel_at_period_end: boolean;

  /** ID del preapproval de MP (solo en cobros mensuales con débito automático). */
  mp_preapproval_id: string | null;
  /** Referencia que NOSOTROS le pasamos a MP para matchear webhooks. */
  mp_external_reference: string | null;

  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// AI usage counters
// ────────────────────────────────────────────────────────────────────────────

export interface AiUsageCounter {
  id: string;
  subscription_id: string;
  period_started_at: string;
  period_ends_at: string;

  /** Cuántos análisis de piel consumió en este período. */
  skin_diagnosis_used: number;
  /** Cuántas generaciones de protocolo consumió en este período. */
  protocol_generator_used: number;

  /**
   * Cuota EXTRA del período aportada por add-ons comprados.
   * El total disponible = (plan.limits.X) + (este bonus).
   */
  skin_diagnosis_bonus_quota: number;
  protocol_generator_bonus_quota: number;

  created_at: string;
  updated_at: string;
}

/** Resumen calculado a partir de counter + plan limit. Lo devuelve AIQuotaService. */
export interface AiQuotaStatus {
  /** Tipo de cuota consultada. */
  kind: 'skin_diagnosis' | 'protocol';
  /** Cuota base del plan para este período. null = ilimitado (Centro). */
  plan_limit: number | null;
  /** Cuota extra acumulada del período (add-ons). */
  bonus: number;
  /** Cuánto se usó hasta ahora. */
  used: number;
  /** Total disponible = plan_limit + bonus (∞ si plan_limit es null). */
  total_available: number | null;
  /** Cuánto queda disponible. ∞ si ilimitado. */
  remaining: number | null;
  /** True si ya superó la cuota. */
  exhausted: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Add-on purchases
// ────────────────────────────────────────────────────────────────────────────

export type AddonPurchaseStatus = 'pending' | 'paid' | 'failed';

export interface AiAddonPurchase {
  id: string;
  subscription_id: string;
  addon_type: string;
  quantity_added: number;
  amount_ars: number;
  status: AddonPurchaseStatus;
  mp_payment_id: string | null;
  mp_external_reference: string | null;
  applied_to_period_start: string | null;
  applied_to_period_end: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failed_reason: string | null;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// SaaS invoices (appestetika → clínica, NOT clínica → paciente)
// ────────────────────────────────────────────────────────────────────────────

export type SaasInvoiceStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type SaasInvoiceKind = 'subscription' | 'addon' | 'upgrade_diff';

export interface SaasInvoice {
  id: string;
  subscription_id: string;
  amount_ars: number;
  billing_period_start: string;
  billing_period_end: string;
  invoice_kind: SaasInvoiceKind;
  status: SaasInvoiceStatus;
  mp_payment_id: string | null;
  mp_external_reference: string | null;
  paid_at: string | null;
  failed_at: string | null;
  failed_reason: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Plan change events
// ────────────────────────────────────────────────────────────────────────────

export interface PlanChangeEvent {
  id: string;
  subscription_id: string;
  from_plan: string;
  to_plan: string;
  from_billing_cycle: string | null;
  to_billing_cycle: string | null;
  /** Cuándo se debe aplicar. Now para upgrades, period_ends_at para downgrades. */
  effective_at: string;
  /** Cuándo se aplicó realmente. NULL = pendiente, lo procesa un cron. */
  applied_at: string | null;
  charge_amount_ars: number | null;
  saas_invoice_id: string | null;
  triggered_by_user_id: string | null;
  reason: string | null;
  created_at: string;
}
