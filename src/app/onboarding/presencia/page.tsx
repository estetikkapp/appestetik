import Link from 'next/link';
import { finalizeOnboarding } from '@/actions/organizations';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Onboarding — presencia' };

export default function OnboardingStep4({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <OnboardingStepper current={5} />

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Tu presencia online</h2>
          <p className="mt-1 text-sm text-stone-500">
            Elegí la URL pública para que tus clientas puedan reservar turnos.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={finalizeOnboarding} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL pública *</Label>
            <div className="flex rounded-lg border border-stone-300 focus-within:ring-2 focus-within:ring-brand-500">
              <span className="flex items-center border-r border-stone-300 bg-stone-50 px-3 text-sm text-stone-500">
                appestetika.com.ar/c/
              </span>
              <Input
                id="slug"
                name="slug"
                required
                minLength={3}
                maxLength={40}
                pattern="[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?"
                placeholder="mi-centro"
                className="rounded-l-none border-0 focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-stone-500">
              3-40 caracteres. Solo minúsculas, números y guiones. No se puede cambiar fácilmente
              después.
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

          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" asChild>
              <Link href="/onboarding/servicio">← Atrás</Link>
            </Button>
            <SubmitButton variant="premium" pendingText="Finalizando...">
              Terminar onboarding
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
