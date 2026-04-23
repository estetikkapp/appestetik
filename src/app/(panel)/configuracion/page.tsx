import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOrganizationSettings } from '@/actions/organization-settings';
import { uploadOrganizationLogo } from '@/actions/storage';

export const metadata = { title: 'Configuración — appestetika' };

async function loadOrg() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;
  const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single();
  return data;
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const org = await loadOrg();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Configuración</h1>
        <p className="mt-1 text-sm text-stone-500">Datos de tu centro e integraciones.</p>
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok === 'guardado' && 'Cambios guardados.'}
          {searchParams.ok === 'logo-subido' && 'Logo actualizado.'}
        </div>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Logo del centro</h2>
        <div className="flex items-center gap-6">
          {org?.logo_url ? (
            <img
              src={org.logo_url}
              alt="Logo"
              className="h-24 w-24 rounded-full border border-stone-200 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400">
              Sin logo
            </div>
          )}
          <form action={uploadOrganizationLogo} className="flex-1 space-y-2">
            <Label htmlFor="logo">Subir archivo (PNG, JPG, WEBP, SVG — máx 5MB)</Label>
            <div className="flex gap-2">
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                required
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-700"
              />
              <Button type="submit" variant="outline">
                Subir
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Datos fiscales</h2>
        <form action={updateOrganizationSettings} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del centro *</Label>
              <Input id="name" name="name" required defaultValue={org?.name ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legal_name">Razón social</Label>
              <Input id="legal_name" name="legal_name" defaultValue={org?.legal_name ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuit">CUIT</Label>
              <Input
                id="cuit"
                name="cuit"
                defaultValue={org?.cuit ?? ''}
                placeholder="XX-XXXXXXXX-X"
                maxLength={13}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax_condition">Condición IVA</Label>
              <select
                id="tax_condition"
                name="tax_condition"
                defaultValue={org?.tax_condition ?? ''}
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">Seleccionar</option>
                <option value="monotributo">Monotributo</option>
                <option value="responsable_inscripto">Responsable Inscripto</option>
                <option value="exento">Exento</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-500 sm:grid-cols-3">
            <Row label="Slug público" value={org?.slug ? `/c/${org.slug}` : '—'} />
            <Row label="Timezone" value={org?.timezone ?? '—'} />
            <Row label="Subscripción" value={org?.subscription_tier ?? '—'} />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Integraciones</h2>
        <div className="space-y-3">
          <IntegrationRow
            name="AFIP (Facturación electrónica)"
            status={org?.afip_provider === 'tusfacturas' ? 'active' : 'pending'}
            hint={
              org?.afip_provider === 'tusfacturas'
                ? 'Configurado con TusFacturas API'
                : 'Se configura en Sprint 4. Mientras tanto emitimos comprobantes internos no fiscales.'
            }
          />
          <IntegrationRow
            name="Mercado Pago"
            status="pending"
            hint="Integración viene en Sprint 3."
          />
          <IntegrationRow
            name="WhatsApp Business"
            status="pending"
            hint="Integración viene en Sprint 3."
          />
          <IntegrationRow
            name="Claude API (IA)"
            status="pending"
            hint="Análisis de piel + generador de protocolos en Sprint 5."
          />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="font-medium uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-stone-800">{value ?? '—'}</dd>
    </div>
  );
}

function IntegrationRow({
  name,
  status,
  hint,
}: {
  name: string;
  status: 'active' | 'pending';
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-stone-100 p-3">
      <div>
        <div className="font-medium text-stone-900">{name}</div>
        <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
      </div>
      {status === 'active' ? (
        <Badge variant="success">Activo</Badge>
      ) : (
        <Badge variant="secondary">Pendiente</Badge>
      )}
    </div>
  );
}
