import Link from 'next/link';
import { updateBusinessHours } from '@/actions/organizations';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Onboarding — horarios' };

const DAYS = [
  { idx: 1, label: 'Lunes' },
  { idx: 2, label: 'Martes' },
  { idx: 3, label: 'Miércoles' },
  { idx: 4, label: 'Jueves' },
  { idx: 5, label: 'Viernes' },
  { idx: 6, label: 'Sábado' },
  { idx: 0, label: 'Domingo' },
];

// Defaults: Lun-Vie 9-19, Sáb 9-13, Dom cerrado
function defaultFor(day: number): { active: boolean; opens: string; closes: string } {
  if (day === 0) return { active: false, opens: '09:00', closes: '13:00' };
  if (day === 6) return { active: true, opens: '09:00', closes: '13:00' };
  return { active: true, opens: '09:00', closes: '19:00' };
}

async function loadExisting(): Promise<Record<number, { active: boolean; opens: string; closes: string }>> {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return {};

  const { data } = await supabase.from('business_hours').select('*').eq('organization_id', orgId);
  const map: Record<number, { active: boolean; opens: string; closes: string }> = {};
  data?.forEach((row) => {
    map[row.day_of_week] = {
      active: row.active,
      opens: row.opens_at ?? '09:00',
      closes: row.closes_at ?? '19:00',
    };
  });
  return map;
}

export default async function OnboardingStep2({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const existing = await loadExisting();

  return (
    <div>
      <OnboardingStepper current={3} />

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Horarios de atención</h2>
          <p className="mt-1 text-sm text-stone-500">
            Estos son los horarios por defecto de tu centro. Se pueden ajustar después.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={updateBusinessHours} className="space-y-3">
          {DAYS.map(({ idx, label }) => {
            const saved = existing[idx];
            const fallback = defaultFor(idx);
            const active = saved?.active ?? fallback.active;
            const opens = saved?.opens ?? fallback.opens;
            const closes = saved?.closes ?? fallback.closes;

            return (
              <div
                key={idx}
                className="flex items-center gap-4 rounded-lg border border-stone-200 p-3"
              >
                <label className="flex w-32 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name={`active_${idx}`}
                    defaultChecked={active}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
                <div className="flex flex-1 items-center gap-2">
                  <label className="text-xs text-stone-500" htmlFor={`opens_${idx}`}>
                    Abre
                  </label>
                  <input
                    type="time"
                    id={`opens_${idx}`}
                    name={`opens_${idx}`}
                    defaultValue={opens}
                    className="rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                  <label className="text-xs text-stone-500" htmlFor={`closes_${idx}`}>
                    Cierra
                  </label>
                  <input
                    type="time"
                    id={`closes_${idx}`}
                    name={`closes_${idx}`}
                    defaultValue={closes}
                    className="rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" asChild>
              <Link href="/onboarding">← Atrás</Link>
            </Button>
            <SubmitButton pendingText="Guardando...">Siguiente: primer servicio →</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
