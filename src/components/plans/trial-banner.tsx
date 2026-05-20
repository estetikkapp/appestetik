import Link from 'next/link';
import { cookies } from 'next/headers';
import { Clock, AlertTriangle } from 'lucide-react';
import { getOrgFeatureContext } from '@/lib/plans/subscription-service';
import { PLANS } from '@/lib/plans/definitions';

/**
 * Banner contextual con estado de la suscripción. Server component.
 *
 *   trialing                → mensaje suave "te quedan X días"
 *   trialing (≤7 días)      → mensaje más urgente con CTA al pago
 *   past_due                → "no pudimos cobrar, regularizá"
 *   suspended               → "suspendida, contactá soporte"
 *   trial_expired           → "trial vencido, activá un plan"
 *   active / legacy         → nada
 */
export async function TrialBanner() {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const { subscription, isGrandfathered } = await getOrgFeatureContext(orgId);
  if (!subscription || isGrandfathered) return null;

  const plan = PLANS[subscription.plan_id];
  const planName = plan?.name ?? subscription.plan_id;

  // trialing
  if (subscription.status === 'trialing' && subscription.trial_ends_at) {
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const urgent = daysLeft <= 7;

    return (
      <div
        className={`rounded-xl border p-4 text-sm ${
          urgent
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-stone-200 bg-stone-50 text-stone-700'
        }`}
      >
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>
              <strong>
                Prueba gratuita de {planName}:{' '}
                {daysLeft === 0
                  ? 'termina hoy'
                  : daysLeft === 1
                    ? 'te queda 1 día'
                    : `te quedan ${daysLeft} días`}
                .
              </strong>{' '}
              {urgent
                ? 'Cuando se cumplan, vas a poder seguir usando lo que cargaste pero sin agregar más. Activá tu plan para no cortar.'
                : 'Probá lo que necesites — al final te avisamos para que decidas si pagás.'}
            </p>
          </div>
          {urgent && (
            <Link
              href="/configuracion"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Ver mi plan
            </Link>
          )}
        </div>
      </div>
    );
  }

  // past_due
  if (subscription.status === 'past_due') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>
              <strong>No pudimos cobrar tu suscripción.</strong> Estamos
              reintentando — si en los próximos días no se resuelve, la cuenta
              pasa a solo lectura. Verificá tu tarjeta en{' '}
              <Link href="/configuracion" className="font-medium underline">
                Mi plan
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // suspended
  if (subscription.status === 'suspended') {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>
              <strong>Tu suscripción está suspendida.</strong> La cuenta está en
              modo solo lectura. Contactá soporte para regularizar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // trial_expired
  if (subscription.status === 'trial_expired') {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>
              <strong>Tu prueba gratuita venció.</strong> Vas a poder ver lo que
              cargaste pero no podés agregar más. Para volver a operar normal,{' '}
              <Link href="/precios" className="font-medium underline">
                activá un plan
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // cancelled (sigue activa hasta fin de período)
  if (subscription.status === 'cancelled') {
    const endDate = new Date(subscription.current_period_ends_at);
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>
              <strong>Suscripción cancelada.</strong> Sigue activa hasta el{' '}
              {endDate.toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'America/Argentina/Buenos_Aires',
              })}
              .{' '}
              <Link href="/configuracion" className="font-medium underline">
                ¿La reactivás?
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
