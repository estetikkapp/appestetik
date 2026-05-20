/**
 * Definiciones de planes y add-ons del SaaS appestetika.
 *
 * Hardcoded en código (no en DB) por elección de arquitectura:
 *   - Cambian poco. Cuando cambian, queremos PR review.
 *   - Cero roundtrip de DB para chequear features / limits.
 *   - Fácil de testear con jest sin mock de Supabase.
 *
 * Para agregar un plan nuevo (ej. cuando lance "Centro" en serio):
 *   1) Agregar el `PlanId` al union.
 *   2) Agregar la entrada en PLANS con todos los campos.
 *   3) Setear `available_in_ui: true` (centro hoy queda en false).
 *   4) Actualizar tests de PlanService.
 *
 * Las clínicas existentes con plan_id de un plan que se elimina del config
 * van a romper en runtime — esto es intencional: forzar migración explícita
 * antes de borrar un plan vivo en producción.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type PlanId = 'gabinete' | 'equipo' | 'centro';
export type BillingCycle = 'monthly' | 'yearly';

/**
 * Feature flags consultables vía `canAccessFeature(role, plan, feature)`.
 * Agregar nuevas acá + en cada PlanDefinition.features.
 */
export type FeatureFlag =
  | 'multi_usuario'
  | 'dashboard_empleadas'
  | 'comisiones'
  | 'inventario'
  | 'reportes_avanzados'
  | 'soporte_prioritario';

export interface PlanLimits {
  /** Cantidad máxima de memberships activos. null = ilimitado. */
  users: number | null;
  /** Análisis de piel con Claude Vision por período. null = ilimitado. */
  ai_skin_diagnosis_per_month: number | null;
  /** Generaciones de protocolos por período. null = ilimitado. */
  ai_protocol_per_month: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Tagline cómplice argentino — aparece en /precios. */
  tagline: string;
  /** Si false, no se ofrece en checkout (centro = WIP hasta sprint futuro). */
  available_in_ui: boolean;
  /** Precio en ARS por mes (cobro mensual). */
  price_monthly_ars: number;
  /** Precio en ARS por año (cobro único, equivale a 10 meses de mensual). */
  price_yearly_ars: number;
  /** Para mostrar "ahorrás N meses" en el toggle anual. */
  yearly_free_months: number;
  limits: PlanLimits;
  features: Record<FeatureFlag, boolean>;
  /** Texto largo para la tarjeta en /precios. */
  description_long: string;
  /** Features incluidas — texto plain para listar. Foco en lo que SÍ tiene. */
  description_features_yes: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Plans
// ────────────────────────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, PlanDefinition> = {
  gabinete: {
    id: 'gabinete',
    name: 'Gabinete',
    tagline: 'Para vos que atendés sola',
    available_in_ui: true,
    price_monthly_ars: 29990,
    price_yearly_ars: 299900, // 10 meses (2 bonificados)
    yearly_free_months: 2,
    limits: {
      users: 1,
      ai_skin_diagnosis_per_month: 20,
      ai_protocol_per_month: 10,
    },
    features: {
      multi_usuario: false,
      dashboard_empleadas: false,
      comisiones: false,
      inventario: false,
      reportes_avanzados: false,
      soporte_prioritario: false,
    },
    description_long:
      'Para cosmetólogas que atienden solas. Todo lo que necesitás para que tu día funcione sin pelearte con el calendario ni con AFIP.',
    description_features_yes: [
      'Agenda + reservas online + widget para tu web',
      'WhatsApp + recordatorios automáticos',
      'Mercado Pago (señas y cobros)',
      'Facturación AFIP automática (C y B)',
      'Paquetes prepagos con tracking',
      'Ficha clínica + fotos antes/después',
      'Consentimientos digitales firmados',
      'Reportes básicos (facturación, no-shows, paquetes)',
      'Soporte WhatsApp en horario AR',
      '20 análisis de piel con IA por mes',
      '10 generaciones de protocolos con IA por mes',
    ],
  },

  equipo: {
    id: 'equipo',
    name: 'Equipo',
    tagline: 'Para cuando ya no estás sola',
    available_in_ui: true,
    price_monthly_ars: 54990,
    price_yearly_ars: 549900,
    yearly_free_months: 2,
    limits: {
      users: 5,
      ai_skin_diagnosis_per_month: 100,
      ai_protocol_per_month: 40,
    },
    features: {
      multi_usuario: true,
      dashboard_empleadas: true,
      comisiones: true,
      inventario: true,
      reportes_avanzados: true,
      soporte_prioritario: true,
    },
    description_long:
      'Para centros con equipo de hasta 5 personas. Cada profesional con su agenda, sus comisiones, su dashboard.',
    description_features_yes: [
      'Todo lo de Gabinete +',
      'Hasta 5 usuarios',
      'Asignación de clientas a profesionales',
      'Dashboard por empleada (facturación, clientas atendidas)',
      'Comisiones automáticas por empleada y servicio',
      'Inventario y stock de productos',
      'Reportes avanzados (rentabilidad por servicio, empleada, horario)',
      'Soporte WhatsApp prioritario',
      'Onboarding con video-llamada',
      'Garantía 60 días',
      '100 análisis de piel con IA por mes',
      '40 generaciones de protocolos con IA por mes',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Plan CENTRO — arquitectura preparada, NO en UI ni en checkout.
  // Precios y features finales se confirman en sprint futuro.
  // Importante: si una org tuviera plan_id='centro' por algún manual override,
  // la app no rompe (los features y limits están definidos), solo no aparece
  // en la página de precios ni en el checkout.
  // ──────────────────────────────────────────────────────────────────────────
  centro: {
    id: 'centro',
    name: 'Centro',
    tagline: 'Para multi-sucursal',
    available_in_ui: false,
    price_monthly_ars: 0, // TBD
    price_yearly_ars: 0, // TBD
    yearly_free_months: 2,
    limits: {
      users: null, // ilimitado
      ai_skin_diagnosis_per_month: null,
      ai_protocol_per_month: null,
    },
    features: {
      multi_usuario: true,
      dashboard_empleadas: true,
      comisiones: true,
      inventario: true,
      reportes_avanzados: true,
      soporte_prioritario: true,
    },
    description_long:
      'Para cadenas con múltiples sucursales. Pricing y features finales se confirman en sprint posterior.',
    description_features_yes: [
      'Todo lo de Equipo +',
      'Multi-sucursal',
      'Usuarios ilimitados',
      'IA ilimitada',
      'API para integraciones',
      'Account manager dedicado',
    ],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Add-ons
// ────────────────────────────────────────────────────────────────────────────

export type AddonId = 'skin_diagnosis_50' | 'protocol_25';
export type AddonKind = 'skin_diagnosis' | 'protocol';

export interface AddonDefinition {
  id: AddonId;
  name: string;
  /** Descripción corta para checkout y modal. */
  description: string;
  /** Mapea contra el counter correspondiente en ai_usage_counters. */
  kind: AddonKind;
  /** Cuánta cuota suma. No se acumula al siguiente período. */
  quantity: number;
  price_ars: number;
}

export const ADDONS: Record<AddonId, AddonDefinition> = {
  skin_diagnosis_50: {
    id: 'skin_diagnosis_50',
    name: 'Pack IA — 50 análisis de piel extra',
    description:
      'Sumás 50 análisis a tu cuota del mes en curso. No se acumula al próximo mes.',
    kind: 'skin_diagnosis',
    quantity: 50,
    price_ars: 4990,
  },
  protocol_25: {
    id: 'protocol_25',
    name: 'Pack IA — 25 protocolos extra',
    description:
      'Sumás 25 generaciones a tu cuota del mes. No se acumula al próximo mes.',
    kind: 'protocol',
    quantity: 25,
    price_ars: 4990,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Constantes globales del sistema de planes
// ────────────────────────────────────────────────────────────────────────────

/** Duración del trial gratis (días). Mismo para todos los planes. */
export const TRIAL_DAYS = 30;

/**
 * Días de gracia entre 'past_due' (cobro mensual fallido) y 'suspended'.
 * Durante este período la app sigue accesible, pero se intentan los retries
 * de cobro.
 */
export const SUSPENSION_GRACE_DAYS = 7;

/**
 * Tras 'trial_expired' (trial vencido sin método de pago), días de acceso
 * READ-ONLY antes de pasar a archivar.
 */
export const TRIAL_EXPIRED_READONLY_DAYS = 15;

/**
 * Schedule de reintentos de cobro tras un payment failed (en días desde el
 * primer intento). 3 intentos en 7 días.
 */
export const RETRY_SCHEDULE_DAYS: readonly number[] = [2, 4, 7];

/**
 * Garantía Plan Equipo: si la tasa de no-shows no baja >= 30% del mes 1 al
 * mes 2, el cliente puede solicitar devolución del primer mes pagado dentro
 * de esta ventana. NO se procesa automáticamente — endpoint que el equipo
 * de soporte ejecuta tras revisión humana.
 */
export const EQUIPO_WARRANTY_DAYS = 60;
export const EQUIPO_WARRANTY_NO_SHOW_DROP_THRESHOLD = 0.3;

// ────────────────────────────────────────────────────────────────────────────
// Helpers puros (consumidos por SubscriptionService en la próxima capa)
// ────────────────────────────────────────────────────────────────────────────

/** Devuelve la definición o lanza si el ID no existe. Útil en server actions. */
export function getPlanOrThrow(planId: string): PlanDefinition {
  const p = PLANS[planId as PlanId];
  if (!p) {
    throw new Error(`Plan desconocido: ${planId}. Ver src/lib/plans/definitions.ts.`);
  }
  return p;
}

/** Planes que aparecen en /precios (centro queda fuera hoy). */
export function getPublicPlans(): PlanDefinition[] {
  return Object.values(PLANS).filter((p) => p.available_in_ui);
}
