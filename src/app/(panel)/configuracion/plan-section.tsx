import Link from 'next/link';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cookies } from 'next/headers';
import { getOrgFeatureContext } from '@/lib/plans/subscription-service';
import { PLANS } from '@/lib/plans/definitions';
import { formatArs } from '@/lib/utils/format-ars';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from '@/actions/subscriptions';
import { ActivatePlanButton } from '@/components/plans/activate-plan-button';

/**
 * Sección "Mi plan" en /configuracion.
 *
 * Muestra plan actual, status, fechas, botones cancel/reactivate, y link
 * a /precios para upgrade. Si org es grandfathered, lo aclara.
 */
export async function PlanSection() {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const { subscription, isGrandfathered } = await getOrgFeatureContext(orgId);

  if (!subscription) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold">Mi plan</h2>
        <p className="text-sm text-stone-500">
          Todavía no tenés plan activo.{' '}
          <Link href="/precios" className="text-brand-600 underline">
            Elegí uno
          </Link>
          .
        </p>
      </section>
    );
  }

  const plan = PLANS[subscription.plan_id];
  const periodEnd = new Date(subscription.current_period_ends_at);
  const isLegacy = isGrandfathered;
  const isForever = periodEnd.getUTCFullYear() > 9000;

  const statusBadge = getStatusBadge(subscription.status, isLegacy);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mi plan</h2>
        {statusBadge}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Plan actual</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{plan?.name ?? subscription.plan_id}</p>
          <p className="mt-0.5 text-sm text-stone-500">{plan?.tagline}</p>

          {plan && !isLegacy && (
            <p className="mt-3 text-sm">
              <span className="font-semibold text-stone-900">
                {subscription.billing_cycle === 'yearly'
                  ? formatArs(plan.price_yearly_ars)
                  : formatArs(plan.price_monthly_ars)}
              </span>{' '}
              <span className="text-stone-500">
                /{subscription.billing_cycle === 'yearly' ? 'año' : 'mes'}
              </span>
            </p>
          )}

          {isLegacy && (
            <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
              🎁 Cuenta legacy con acceso completo sin costo.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Estado</p>

          {subscription.status === 'trialing' && subscription.trial_ends_at && (
            <div className="mt-1 text-sm text-stone-700">
              <p>Trial gratis</p>
              <p className="mt-1 text-stone-500">
                Termina el {formatDateAr(new Date(subscription.trial_ends_at))}
              </p>
            </div>
          )}

          {(subscription.status === 'active' || subscription.status === 'cancelled') && !isForever && (
            <div className="mt-1 text-sm text-stone-700">
              <p>
                {subscription.status === 'cancelled'
                  ? 'Cancelada — vigente hasta'
                  : 'Próximo cobro'}
              </p>
              <p className="mt-1 text-stone-500">{formatDateAr(periodEnd)}</p>
            </div>
          )}

          {subscription.status === 'past_due' && (
            <div className="mt-1 text-sm text-amber-700">
              <p>Pago pendiente</p>
              <p className="mt-1 text-xs">Reintentamos automáticamente.</p>
            </div>
          )}

          {subscription.status === 'suspended' && (
            <div className="mt-1 text-sm text-red-700">
              <p>Suspendida</p>
              <p className="mt-1 text-xs">Contactá soporte para reactivar.</p>
            </div>
          )}

          {isForever && (
            <p className="mt-1 text-sm text-stone-700">Sin vencimiento</p>
          )}
        </div>
      </div>

      {/* CTA de activación de pago: cuando está en trial o el trial venció,
          la clienta puede activar el débito real desde acá. */}
      {!isLegacy && (subscription.status === 'trialing' || subscription.status === 'trial_expired') && (
        <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
          <p className="mb-3 text-sm text-stone-700">
            {subscription.status === 'trialing'
              ? 'Activá tu plan ahora para que no se corte el servicio cuando termine la prueba. El primer cobro es al finalizar el trial.'
              : 'Tu prueba terminó. Activá tu plan para seguir usando appestetika.'}
          </p>
          <ActivatePlanButton
            label={`Activar ${plan?.name ?? 'plan'} · ${
              subscription.billing_cycle === 'yearly'
                ? `${formatArs(plan?.price_yearly_ars ?? 0)}/año`
                : `${formatArs(plan?.price_monthly_ars ?? 0)}/mes`
            }`}
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
        {!isLegacy && subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
          <>
            {subscription.plan_id === 'gabinete' && (
              <Link
                href="/precios"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Subir a Equipo
              </Link>
            )}
            <form action={cancelSubscriptionAction}>
              <SubmitButton variant="outline" size="sm" pendingText="Cancelando...">
                Cancelar suscripción
              </SubmitButton>
            </form>
          </>
        )}

        {subscription.status === 'cancelled' && (
          <form action={reactivateSubscriptionAction}>
            <SubmitButton variant="default" pendingText="Reactivando...">
              Reactivar
            </SubmitButton>
          </form>
        )}

        <Link href="/precios" className="text-sm text-brand-600 hover:underline">
          Ver todos los planes →
        </Link>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function getStatusBadge(status: string, isLegacy: boolean) {
  if (isLegacy) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Legacy — acceso completo
      </Badge>
    );
  }
  switch (status) {
    case 'trialing':
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" /> Trial
        </Badge>
      );
    case 'active':
      return (
        <Badge variant="success">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Activa
        </Badge>
      );
    case 'past_due':
      return (
        <Badge variant="secondary">
          <AlertTriangle className="mr-1 h-3 w-3" /> Pago pendiente
        </Badge>
      );
    case 'suspended':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" /> Suspendida
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" /> Cancelada
        </Badge>
      );
    case 'trial_expired':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" /> Trial vencido
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" /> Expirada
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDateAr(d: Date): string {
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

