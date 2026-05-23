import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { selectInitialPlanAction } from '@/actions/subscriptions';
import { PLANS, getPublicPlans, type PlanId } from '@/lib/plans/definitions';
import { getActiveSubscription } from '@/lib/plans/subscription-service';
import { formatArs } from '@/lib/utils/format-ars';
import { SubmitButton } from '@/components/ui/submit-button';
import { Check } from 'lucide-react';

export const metadata = { title: 'Onboarding — elegí tu plan' };

export default async function OnboardingPlanPicker({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const orgId = cookies().get('active_org')?.value;

  // Si ya hay sub viva, saltar al siguiente paso (datos fiscales)
  if (orgId) {
    const existing = await getActiveSubscription(orgId);
    if (existing) {
      redirect('/onboarding');
    }
  }

  const plans = getPublicPlans();

  return (
    <div>
      <OnboardingStepper current={1} />

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">¿Cómo trabajás?</h2>
          <p className="mt-1 text-sm text-stone-500">
            Esto define qué te mostramos en la app. Después podés cambiar gratis durante
            los 14 días de prueba.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanForm
              key={plan.id}
              planId={plan.id}
              isRecommended={plan.id === 'equipo'}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          14 días gratis. Sin tarjeta. Cuando termine el trial, te avisamos por mail
          para que decidas si pagás o no.
        </p>
      </div>
    </div>
  );
}

function PlanForm({
  planId,
  isRecommended,
}: {
  planId: PlanId;
  isRecommended: boolean;
}) {
  const plan = PLANS[planId];
  return (
    <form
      action={selectInitialPlanAction}
      className={`flex flex-col rounded-2xl border-2 bg-white p-6 transition-colors ${
        isRecommended ? 'border-brand-500' : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="billing_cycle" value="monthly" />

      {isRecommended && (
        <span className="mb-2 inline-block w-fit rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
          Más elegido
        </span>
      )}

      <h3 className="text-xl font-bold text-stone-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-stone-600">{plan.tagline}</p>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-stone-900">
          {formatArs(plan.price_monthly_ars)}
        </span>
        <span className="text-xs text-stone-500">/mes</span>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {plan.description_features_yes.slice(0, 6).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-stone-700">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
        {plan.description_features_yes.length > 6 && (
          <li className="ml-5 text-xs text-stone-400">
            + {plan.description_features_yes.length - 6} cosas más
          </li>
        )}
      </ul>

      <SubmitButton
        className="mt-6 w-full"
        variant={isRecommended ? 'default' : 'outline'}
        pendingText="Activando..."
      >
        Probar {plan.name} 14 días gratis
      </SubmitButton>
    </form>
  );
}
