import { updateOrganizationFiscal } from '@/actions/organizations';
import { OnboardingStepper } from '@/components/onboarding/stepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const metadata = { title: 'Onboarding — datos fiscales' };

async function getCurrentOrg() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [orgResult, membershipResult] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase
      .from('memberships')
      .select('display_name')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .single(),
  ]);

  return { org: orgResult.data, membership: membershipResult.data };
}

export default async function OnboardingStep1({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const data = await getCurrentOrg();

  return (
    <div>
      <OnboardingStepper current={1} />

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Datos fiscales de tu centro</h2>
          <p className="mt-1 text-sm text-stone-500">
            Esto aparece en las facturas que emitas. Podés modificarlo después en configuración.
          </p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={updateOrganizationFiscal} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre del centro *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={data?.org?.name ?? ''}
              placeholder="Ej. Estética Bella"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_name">Tu nombre *</Label>
            <Input
              id="display_name"
              name="display_name"
              required
              defaultValue={data?.membership?.display_name ?? ''}
              placeholder="Como te ven las empleadas"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="legal_name">Razón social (si es distinto del nombre)</Label>
            <Input
              id="legal_name"
              name="legal_name"
              defaultValue={data?.org?.legal_name ?? ''}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cuit">CUIT</Label>
            <Input
              id="cuit"
              name="cuit"
              defaultValue={data?.org?.cuit ?? ''}
              placeholder="XX-XXXXXXXX-X"
              maxLength={13}
            />
            <p className="text-xs text-stone-500">
              Obligatorio para emitir facturas. Podés completarlo después.
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-700">Condición IVA *</legend>
            <div className="flex flex-col gap-2">
              {[
                { value: 'monotributo', label: 'Monotributo' },
                { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
                { value: 'exento', label: 'Exento' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 p-3 hover:border-brand-300"
                >
                  <input
                    type="radio"
                    name="tax_condition"
                    value={opt.value}
                    required
                    defaultChecked={data?.org?.tax_condition === opt.value}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end pt-4">
            <Button type="submit">Siguiente: horarios →</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
