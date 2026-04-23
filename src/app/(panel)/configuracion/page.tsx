import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Configuración — appestetika' };

async function loadOrg() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;
  const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single();
  return data;
}

export default async function ConfiguracionPage() {
  const org = await loadOrg();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Configuración</h1>
        <p className="mt-1 text-sm text-stone-500">Datos de tu centro e integraciones.</p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Datos del centro</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Nombre" value={org?.name} />
          <Row label="Razón social" value={org?.legal_name ?? '—'} />
          <Row label="CUIT" value={org?.cuit ?? '—'} />
          <Row label="Condición IVA" value={org?.tax_condition ?? '—'} />
          <Row label="Slug público" value={org?.slug ? `/c/${org.slug}` : '—'} />
          <Row label="Timezone" value={org?.timezone ?? '—'} />
        </dl>
        <p className="mt-4 text-xs text-stone-400">
          Edición de estos datos viene en Sprint 1c post-merge. Por ahora usá el wizard de
          onboarding si necesitás corregirlos.
        </p>
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
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-stone-900">{value ?? '—'}</dd>
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
