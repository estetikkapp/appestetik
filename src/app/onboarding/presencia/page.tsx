import Link from 'next/link';
import { finalizeOnboarding, finalizeOnboardingSkip } from '@/actions/organizations';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Onboarding — presencia' };

export default function OnboardingStep4({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <OnboardingStepper current={6} />

      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Tu presencia online</h2>
          <p className="mt-1 text-sm text-stone-500">
            Elegí la URL pública para que tus clientas puedan reservar turnos. Si no querés
            reservas online por ahora, podés saltarlo y configurarlo después.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={finalizeOnboarding} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL pública</Label>
            <div className="flex rounded-lg border border-stone-300 focus-within:ring-2 focus-within:ring-brand-500">
              <span className="flex items-center border-r border-stone-300 bg-stone-50 px-3 text-xs text-stone-500 sm:text-sm">
                appestetika.com.ar/c/
              </span>
              <Input
                id="slug"
                name="slug"
                minLength={3}
                maxLength={40}
                pattern="[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?"
                placeholder="mi-centro"
                className="min-w-0 rounded-l-none border-0 focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-stone-500">
              3-40 caracteres. Solo minúsculas, números y guiones. Podés cambiarlo después
              desde Configuración (los links publicados con el anterior dejan de funcionar).
            </p>
          </div>

          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
            <p className="font-medium">Logo del centro</p>
            <p className="mt-1 text-xs text-brand-700">
              Podés subir el logo después desde Configuración. Máx 5MB (PNG, JPG, WEBP, SVG).
            </p>
            <a
              href="/configuracion"
              className="mt-2 inline-block text-xs font-medium text-brand-600 underline"
            >
              Ir a Configuración → Logo (después de terminar onboarding)
            </a>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" asChild>
              <Link href="/onboarding/servicio">← Atrás</Link>
            </Button>

            {/*
              Dos botones de submit. El primero usa formAction=skip que llama
              a finalizeOnboardingSkip — solo setea onboarded_at sin tocar slug.
              formNoValidate skipea el "minLength" + "pattern" del input para
              que el browser no lo bloquee si está vacío.

              El segundo es el submit principal, que sí valida slug.
            */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <SubmitButton
                variant="ghost"
                formAction={finalizeOnboardingSkip}
                formNoValidate
                pendingText="Saltando..."
                className="text-stone-600 hover:text-stone-900"
              >
                Saltar — defino mi URL después
              </SubmitButton>
              <SubmitButton variant="premium" pendingText="Finalizando...">
                Terminar onboarding
              </SubmitButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
