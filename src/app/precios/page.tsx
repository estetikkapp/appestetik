/**
 * Página pública /precios — comparativa de planes.
 *
 * No requiere auth (es marketing). Si el user llega logueado y eligió un
 * plan se pueden mostrar mensajes contextuales (vía ?from=feature_xyz).
 */

import Link from 'next/link';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';
import { getPublicPlans, PLANS, type PlanId } from '@/lib/plans/definitions';
import { formatArs } from '@/lib/utils/format-ars';
import { PricingToggle } from './pricing-toggle';

export const metadata = {
  title: 'Precios — appestetika',
  description: 'Planes para centros de estética. Prueba gratuita de 30 días, sin tarjeta.',
};

// Mapeo de feature_xyz → texto explicativo para el banner contextual.
const FEATURE_REASONS: Record<string, string> = {
  inventario: 'El inventario y el stock están en el plan Equipo.',
  comisiones: 'Las comisiones automáticas están en el plan Equipo.',
  dashboard_empleadas: 'El dashboard por empleada está en el plan Equipo.',
  multi_usuario: 'Sumar empleadas está en el plan Equipo.',
  reportes_avanzados: 'Los reportes avanzados están en el plan Equipo.',
  soporte_prioritario: 'El soporte prioritario está en el plan Equipo.',
};

export default function PreciosPage({
  searchParams,
}: {
  searchParams: { from?: string; cycle?: 'monthly' | 'yearly' };
}) {
  const fromFeature = searchParams.from;
  const reasonText = fromFeature ? FEATURE_REASONS[fromFeature] : null;
  const defaultCycle: 'monthly' | 'yearly' = searchParams.cycle === 'yearly' ? 'yearly' : 'monthly';

  const plans = getPublicPlans();

  return (
    <main className="min-h-screen bg-brand-50/30">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-brand-700">
            appestetika
          </Link>
          <Link href="/auth/login" className="text-sm text-brand-600 hover:underline">
            Iniciar sesión →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {reasonText && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>{reasonText}</strong> Mirá los planes y elegí el que te conviene.
          </div>
        )}

        <section className="text-center">
          <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
            Precios pensados para vos
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-stone-600">
            Sin tarjeta. Sin contrato. Pagás cuando te convence. Probás 30 días gratis,
            después decidís.
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <PricingToggle defaultCycle={defaultCycle} />
        </div>

        <section
          id="plans"
          className="mt-10 grid gap-6 md:grid-cols-2"
          data-cycle={defaultCycle}
        >
          {plans.map((plan) => (
            <PlanCard key={plan.id} planId={plan.id} cycle={defaultCycle} />
          ))}
        </section>

        <section className="mt-16 rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <h2 className="text-2xl font-bold text-stone-900">¿Y la IA?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-stone-600">
            Cada plan trae cuota mensual de análisis de piel y generación de protocolos con
            Claude Vision. Si te quedás corta, podés sumar packs extra:
          </p>
          <div className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-left">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <h3 className="mt-2 font-semibold text-stone-900">50 análisis de piel extra</h3>
              <p className="mt-1 text-xs text-stone-500">
                Suma a tu cuota del mes en curso. No se acumula al siguiente.
              </p>
              <p className="mt-3 text-lg font-bold text-stone-900">$4.990</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-left">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <h3 className="mt-2 font-semibold text-stone-900">25 protocolos extra</h3>
              <p className="mt-1 text-xs text-stone-500">
                Suma a tu cuota del mes en curso. No se acumula al siguiente.
              </p>
              <p className="mt-3 text-lg font-bold text-stone-900">$4.990</p>
            </div>
          </div>
        </section>

        <section className="mt-16 text-center text-sm text-stone-500">
          <p>
            ¿Sos cadena con más de una sucursal?{' '}
            <a href="mailto:estetikkapp@gmail.com" className="text-brand-600 hover:underline">
              Hablemos
            </a>
            {' '}— tenemos plan para vos.
          </p>
        </section>
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function PlanCard({
  planId,
  cycle,
}: {
  planId: PlanId;
  cycle: 'monthly' | 'yearly';
}) {
  const plan = PLANS[planId];
  const isEquipo = planId === 'equipo';
  const otherPlanFeatures = PLANS.equipo.features;

  const price = cycle === 'yearly' ? plan.price_yearly_ars : plan.price_monthly_ars;
  const priceMonthlyEquiv =
    cycle === 'yearly' ? Math.round(plan.price_yearly_ars / 12) : null;

  return (
    <article
      className={`rounded-2xl border-2 bg-white p-8 ${
        isEquipo ? 'border-brand-500 shadow-lg' : 'border-stone-200'
      }`}
    >
      {isEquipo && (
        <div className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          Más elegido
        </div>
      )}

      <h3 className="text-2xl font-bold text-stone-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-stone-600">{plan.tagline}</p>

      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-stone-900">{formatArs(price)}</span>
          <span className="text-sm text-stone-500">
            /{cycle === 'yearly' ? 'año' : 'mes'}
          </span>
        </div>
        {priceMonthlyEquiv && (
          <p className="mt-1 text-xs text-stone-500">
            Equivale a {formatArs(priceMonthlyEquiv)}/mes —{' '}
            <span className="font-semibold text-emerald-700">
              ahorrás 2 meses
            </span>
          </p>
        )}
      </div>

      <p className="mt-4 text-sm text-stone-600">{plan.description_long}</p>

      <Link
        href={`/auth/signup?plan=${planId}&cycle=${cycle}`}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
          isEquipo
            ? 'bg-brand-500 text-white hover:bg-brand-600'
            : 'border-2 border-stone-300 text-stone-800 hover:border-stone-400'
        }`}
      >
        Probar 30 días gratis
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-2 text-center text-xs text-stone-500">
        Sin tarjeta. Después si te gusta, pagás.
      </p>

      <ul className="mt-6 space-y-2.5">
        {plan.description_features_yes.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {!isEquipo && (
        <div className="mt-6 border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold uppercase text-stone-400">
            No incluido
          </p>
          <ul className="mt-2 space-y-1.5">
            {(Object.entries(otherPlanFeatures) as Array<[keyof typeof otherPlanFeatures, boolean]>)
              .filter(([f]) => !plan.features[f])
              .map(([f]) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-xs text-stone-500"
                >
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" />
                  <span>{prettyFeatureName(f)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function prettyFeatureName(f: string): string {
  const map: Record<string, string> = {
    multi_usuario: 'Sumar empleadas',
    dashboard_empleadas: 'Dashboard por empleada',
    comisiones: 'Comisiones automáticas',
    inventario: 'Inventario y stock',
    reportes_avanzados: 'Reportes avanzados',
    soporte_prioritario: 'Soporte prioritario',
  };
  return map[f] ?? f;
}
