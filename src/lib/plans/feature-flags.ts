/**
 * Feature flags por plan + RBAC. Funciones puras, sin DB ni cookies.
 *
 * Modelo mental:
 *   - Cada feature está habilitada o no en cada plan (definitions.ts).
 *   - Si la org es `legacy_grandfathered`, override: TODAS las features
 *     desbloqueadas (decisión 2B del owner — las 6 orgs pre-existentes
 *     son sus pruebas, no se les filtra nada).
 *   - El RBAC por rol vive en `src/lib/auth/rbac.ts` (rutas como
 *     /configuracion solo para admin). Acá manejamos el cruce con plan:
 *     un admin de Gabinete NO puede tocar /inventario porque su plan no
 *     incluye `inventario`, aunque su rol sí lo permitiría.
 *
 * Reglas:
 *   - Owner + Admin → todas las features del plan
 *   - Professional + Receptionist → features del plan PERO sin admin-only
 *     (esa parte la cubre rbac.ts via canAccessRoute)
 *   - Grandfathered → todas las features SIEMPRE
 *
 * Importante: estas funciones NO chequean si la sub está 'suspended' o
 * 'expired'. Ese gate vive más arriba (middleware/layout) y bloquea TODA
 * la app en modo read-only. Acá solo se evalúa "este plan incluye esto".
 */

import { PLANS, type FeatureFlag, type PlanId, type PlanDefinition } from './definitions';

/** Contexto necesario para decidir acceso a feature. */
export interface FeatureContext {
  /** ID del plan vigente. */
  planId: PlanId;
  /** Override del owner: ignora plan, da TODAS las features. */
  isGrandfathered: boolean;
}

/**
 * ¿El plan incluye esta feature? Pura — solo consulta definitions.
 *
 * Útil para mostrar/ocultar UI cuando ya tenés el plan en memoria.
 */
export function planHasFeature(planId: PlanId, feature: FeatureFlag): boolean {
  const plan = PLANS[planId];
  if (!plan) return false;
  return plan.features[feature] === true;
}

/**
 * ¿La org puede acceder a esta feature? Considera grandfathering.
 *
 * Llamar desde:
 *   - Componentes server que filtren UI condicional (links, modales, etc.)
 *   - Server actions que enforcement el límite ("subir empleada nueva" requiere `multi_usuario`)
 *
 * No considera el rol del usuario — eso lo cubre `canAccessRoute` en rbac.ts.
 * El cruce role × feature × plan se hace upstream en la página/action.
 */
export function canAccessFeature(ctx: FeatureContext, feature: FeatureFlag): boolean {
  if (ctx.isGrandfathered) return true;
  return planHasFeature(ctx.planId, feature);
}

/**
 * Lista de features que el plan TIENE incluidas. Útil para UI tipo
 * "esto se desbloquea con Equipo". Si grandfathered, devuelve todas.
 */
export function getEnabledFeatures(ctx: FeatureContext): FeatureFlag[] {
  if (ctx.isGrandfathered) {
    return Object.keys(PLANS.equipo.features) as FeatureFlag[];
  }
  const plan = PLANS[ctx.planId];
  if (!plan) return [];
  return (Object.keys(plan.features) as FeatureFlag[]).filter(
    (f) => plan.features[f] === true
  );
}

/**
 * Para el modal de upgrade: dado que el user de Gabinete intentó usar
 * `feature`, ¿qué planes lo desbloquean? (Usualmente Equipo y Centro.)
 * Devuelve los planes disponibles en UI (excluye Centro hoy).
 */
export function getPlansThatUnlock(feature: FeatureFlag): PlanDefinition[] {
  return Object.values(PLANS).filter(
    (p) => p.available_in_ui && p.features[feature] === true
  );
}
