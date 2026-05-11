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

import type { Role } from './require-membership';
import { ROLE_RANK } from './require-membership';

// Re-export para que los consumidores (Sidebar, etc.) no tengan que conocer
// la doble fuente (rbac + require-membership).
export type { Role };

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
 * ¿Este rol puede acceder a esta ruta?
 *
 * Si la ruta no está restringida, todos los roles pasan.
 * Match exacto o prefijo (ej. /configuracion/sub también queda bloqueado).
 */
export function canAccessRoute(role: Role, pathname: string): boolean {
  for (const [route, minRole] of Object.entries(ROUTE_MIN_ROLE)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return ROLE_RANK[role] >= ROLE_RANK[minRole];
    }
  }
  return true;
}

export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
