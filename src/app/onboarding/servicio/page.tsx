import Link from 'next/link';
import { createFirstService } from '@/actions/organizations';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Onboarding — primer servicio' };

const CATEGORIES = [
  'depilacion',
  'facial',
  'corporal',
  'unias',
  'masajes',
  'otro',
] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  depilacion: 'Depilación',
  facial: 'Facial',
  corporal: 'Corporal',
  unias: 'Uñas',
  masajes: 'Masajes',
  otro: 'Otro',
};

export default function OnboardingStep3({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <OnboardingStepper current={5} />

      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Tu primer servicio</h2>
          <p className="mt-1 text-sm text-stone-500">
            Cargá uno para empezar. Más adelante podés agregar todos los que quieras.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={createFirstService} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre del servicio *</Label>
            <Input id="name" name="name" required placeholder="Ej. Limpieza facial profunda" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Categoría</Label>
            <select
              id="category"
              name="category"
              className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
              defaultValue=""
            >
              <option value="">Seleccioná una categoría</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="duration_minutes">Duración (minutos) *</Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={5}
                step={5}
                required
                defaultValue={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price_ars">Precio (ARS) *</Label>
              <Input
                id="price_ars"
                name="price_ars"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={15000}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" asChild>
              <Link href="/onboarding/horarios">← Atrás</Link>
            </Button>
            <SubmitButton pendingText="Creando...">Siguiente: presencia →</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
