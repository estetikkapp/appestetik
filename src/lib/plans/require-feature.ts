/**
 * Guard server-side para páginas que requieren una feature del plan.
 *
 * Si la org NO tiene la feature en su plan (y no es grandfathered):
 *   - Redirige a /precios?from=<feature_id> con contexto, así la página
 *     muestra un banner explicando qué se desbloquea.
 *
 * Decisión 5B del owner: redirigir a /precios con contexto en vez de
 * mostrar modal popup. Una sola pantalla, más fácil de mantener,
 * funciona también si pone la URL a mano.
 *
 * Uso típico en una page admin-only:
 *
 *   export default async function InventarioPage() {
 *     await requireMembership({ minRole: 'admin' });
 *     await requireFeature('inventario');
 *     // ... resto de la página
 *   }
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getOrgFeatureContext } from './subscription-service';
import { canAccessFeature } from './feature-flags';
import type { FeatureFlag } from './definitions';

export async function requireFeature(feature: FeatureFlag): Promise<void> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');

  const { subscription, isGrandfathered } = await getOrgFeatureContext(orgId);
  if (!subscription) {
    // Org sin sub viva → mandar a elegir plan
    redirect(`/precios?from=${feature}`);
  }

  // En estados read-only NO bloqueamos por feature — el banner global ya
  // avisa que está suspended/trial_expired. Devolver al user a /precios
  // por feature sería confuso (el problema real es el pago, no la feature).
  if (subscription.status === 'suspended' || subscription.status === 'trial_expired') {
    return;
  }

  const allowed = canAccessFeature(
    { planId: subscription.plan_id, isGrandfathered },
    feature
  );
  if (!allowed) {
    redirect(`/precios?from=${feature}`);
  }
}
