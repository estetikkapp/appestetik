import Link from 'next/link';
import { Sparkles, ArrowRight, SkipForward } from 'lucide-react';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { ImporterUI } from '@/app/(panel)/configuracion/importar/importer-ui';

export const metadata = { title: 'Onboarding — importar clientas' };

export default function OnboardingImportarPage() {
  return (
    <div>
      <OnboardingStepper current={2} />

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
              <Sparkles className="h-6 w-6 text-brand-500" />
              ¿Tenés clientas cargadas en otro lado?
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Si ya tenés tu base de pacientes en Excel, en un cuaderno o
              donde sea, subila acá y la IA carga todo automáticamente. Si
              estás empezando de cero, saltá este paso y arrancá ya.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Saltar
            <SkipForward className="h-4 w-4" />
          </Link>
        </div>

        <ImporterUI
          onCompleteHref="/onboarding"
          onCompleteLabel="Continuar con el onboarding"
        />

        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
          <Link
            href="/onboarding/plan"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            ← Volver a plan
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
          >
            Continuar (saltear)
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
