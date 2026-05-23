/**
 * RBAC central — matriz de qué rol puede acceder a qué ruta del panel.
 *
 * Dos consumidores principales:
 *   1. `Sidebar` (client component): filtra los items del nav según `role`
 *      del activeMembership para que el user no vea links a los que no
 *      tiene acceso.
 *   2. Cada page server-side que es sensible llama
 *      `requireMembership({ minRole: 'admin' })` al inicio. Si alguien
 *      escribe la URL directo en el browser, lo rebota.
 *
 * Importante: las dos capas son COMPLEMENTARIAS, no alternativas. El
 * sidebar es UX (no mostrar lo que no podés tocar). El check server-side
 * es seguridad (no permitir acceso aunque pongas la URL a mano).
 */

import type { Role } from './roles';
import { ROLE_RANK, hasMinRole } from './roles';
import { planHasFeature } from '@/lib/plans/feature-flags';
import type { FeatureFlag, PlanId } from '@/lib/plans/definitions';

// Re-export para que los consumidores (Sidebar, etc.) no tengan que conocer
// la doble fuente.
export type { Role };
export { hasMinRole };

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dueña',
  admin: 'Administradora',
  professional: 'Profesional',
  receptionist: 'Recepcionista',
};

/**
 * Min rol requerido por ruta del panel. Rutas no listadas son accesibles
 * a cualquier miembro activo (cualquier rol).
 *
 * Criterio de las decisiones:
 *   - Admin/Owner = config completa, integraciones, ABM de catálogo, audit
 *   - Profesional = atender (agenda, clientas, IA para análisis de piel)
 *   - Recepcionista = front desk (agenda, cobros, cierres)
 */
export const ROUTE_MIN_ROLE: Record<string, Role> = {
  '/configuracion': 'admin',
  '/empleadas': 'admin',
  '/servicios': 'admin',
  '/horarios': 'admin',
  '/paquetes': 'admin',
  '/recursos': 'admin',
  '/audit-log': 'admin',
  '/reportes': 'admin',
};

/** Rutas accesibles a profesional+ (no recepcionista) */
const PROFESSIONAL_PLUS: string[] = ['/ia'];
for (const r of PROFESSIONAL_PLUS) {
  ROUTE_MIN_ROLE[r] = 'professional';
}

/**
 * Mapa de rutas → feature que necesitan. Si la ruta no está acá, no requiere
 * feature específica del plan (cualquier plan accede si rol cumple).
 *
 * Criterio: solo gateamos features que están explícitamente en Equipo y NO en
 * Gabinete (según `src/lib/plans/definitions.ts`).
 *
 * `paquetes` NO va acá porque está incluido en AMBOS planes según definitions
 * (description_features_yes lo lista en ambos).
 */
export const ROUTE_FEATURE: Partial<Record<string, FeatureFlag>> = {
  '/empleadas': 'multi_usuario',
  '/reportes': 'reportes_avanzados',
  // Futuras: '/inventario': 'inventario'
};

/**
 * Devuelve el feature que requiere una ruta, o null si no requiere ninguno.
 */
export function routeRequiredFeature(pathname: string): FeatureFlag | null {
  for (const [route, feature] of Object.entries(ROUTE_FEATURE)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return feature ?? null;
    }
  }
  return null;
}

export interface PlanContext {
  planId: PlanId;
  isGrandfathered: boolean;
}

/**
 * ¿Este rol puede acceder a esta ruta?
 *
 * Chequeo en cascada:
 *   1. Rol del usuario >= rol mínimo de la ruta
 *   2. Si la ruta requiere feature y se pasa planContext, el plan la incluye
 *      (o la org es legacy_grandfathered, override total).
 *
 * Si la ruta no está restringida en ningún mapa, todos pasan.
 * Match exacto o prefijo (ej. /configuracion/sub también queda bloqueado).
 *
 * planContext es OPCIONAL — si no se pasa, solo se chequea rol. Esto mantiene
 * compat con callers que no tienen sub a mano (ej. layouts simples).
 */
export function canAccessRoute(
  role: Role,
  pathname: string,
  planContext?: PlanContext
): boolean {
  // 1) Check de rol
  for (const [route, minRole] of Object.entries(ROUTE_MIN_ROLE)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (ROLE_RANK[role] < ROLE_RANK[minRole]) return false;
      break;
    }
  }

  // 2) Check de feature (solo si pasaron planContext)
  if (planContext) {
    const feature = routeRequiredFeature(pathname);
    if (feature && !planContext.isGrandfathered) {
      if (!planHasFeature(planContext.planId, feature)) return false;
    }
  }

  return true;
}

