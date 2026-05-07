import Image from 'next/image';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateOrganizationSettings } from '@/actions/organization-settings';
import { uploadOrganizationLogo } from '@/actions/storage';
import { saveAfipConfig } from '@/actions/afip-config';
import { WhatsappConnectCard } from '@/components/whatsapp/whatsapp-connect-card';
import { EmbedSnippet } from './embed-snippet';
import { WhatsappProviderSection } from './whatsapp-provider-section';

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
  searchParams: { error?: string; ok?: string; wapp?: string };
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
          {searchParams.ok === 'afip-configurado' && 'Configuración AFIP guardada.'}
          {searchParams.ok === 'whatsapp-desconectado' && 'WhatsApp desconectado.'}
          {searchParams.ok === 'cloud-conectado' && 'WhatsApp Cloud API conectado correctamente.'}
        </div>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Logo del centro</h2>
        <div className="flex items-center gap-6">
          {org?.logo_url ? (
            <Image
              src={org.logo_url}
              alt="Logo"
              width={96}
              height={96}
              className="h-24 w-24 rounded-full border border-stone-200 object-cover"
              unoptimized
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
              <SubmitButton variant="outline" pendingText="Subiendo...">
                Subir
              </SubmitButton>
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
            <SubmitButton pendingText="Guardando...">Guardar cambios</SubmitButton>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">WhatsApp — Recordatorios automáticos</h2>
        <p className="mb-4 text-sm text-stone-500">
          Conectá el número de WhatsApp de tu centro para enviar recordatorios automáticos
          24hs antes de cada turno.
        </p>

        <WhatsappProviderSection
          currentProvider={(org?.whatsapp_provider as 'evolution' | 'cloud_api') ?? 'evolution'}
          cloudConfig={
            (org?.whatsapp_cloud_config as Record<string, string> | null) ?? null
          }
          webhookUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com'}/api/whatsapp/cloud-webhook`}
        />

        {/* Connect card de Evolution solo si la org está en provider 'evolution' */}
        {(!org?.whatsapp_provider || org.whatsapp_provider === 'evolution') && (
          <div className="mt-4 border-t border-stone-100 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">
              Conexión Evolution (escaneá QR)
            </h3>
            <WhatsappConnectCard
              initialStatus={(org?.whatsapp_status as 'disconnected' | 'connecting' | 'connected') ?? 'disconnected'}
              initialPhone={org?.whatsapp_phone ?? null}
              startPolling={searchParams.wapp === 'qr'}
            />
          </div>
        )}

        {org?.whatsapp_provider === 'cloud_api' && (
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="text-xs text-stone-500">
              {org.whatsapp_status === 'connected' ? (
                <>
                  ✅ Cloud API conectado. Número:{' '}
                  <strong>{org.whatsapp_phone ?? 'verificado'}</strong>. Recordatorios automáticos
                  activos.
                </>
              ) : (
                <>
                  ⚠️ Cloud API configurada pero las credenciales fallaron en la última validación.
                  Verificá Phone Number ID + Access Token y guardá de nuevo.
                </>
              )}
            </p>
          </div>
        )}
      </section>

      <AfipConfigSection
        provider={org?.afip_provider ?? 'manual'}
        config={(org?.afip_config as Record<string, unknown> | null) ?? null}
      />

      {org?.slug && (
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">Reservas online — link y embed</h2>
          <p className="mb-4 text-sm text-stone-500">
            Compartí el link de reserva o embebé el formulario directo en tu sitio web.
          </p>
          <EmbedSnippet slug={org.slug} />
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Otras integraciones</h2>
        <div className="space-y-3">
          <IntegrationRow
            name="Email transaccional (Resend)"
            status={process.env.RESEND_API_KEY ? 'active' : 'pending'}
            hint={
              process.env.RESEND_API_KEY
                ? 'Configurado. Recordatorios por email funcionan como fallback de WhatsApp.'
                : 'Sin RESEND_API_KEY. Crear cuenta gratis en resend.com (3000 emails/mes), pegar la key en Vercel y redeploy.'
            }
          />
          <IntegrationRow
            name="Mercado Pago"
            status={process.env.MP_ACCESS_TOKEN ? 'active' : 'pending'}
            hint={
              process.env.MP_ACCESS_TOKEN
                ? 'Configurado. Links de pago activos en /cobros.'
                : 'Cargá MP_ACCESS_TOKEN real en Vercel para activar links de pago.'
            }
          />
          <IntegrationRow
            name="Claude API (IA)"
            status={process.env.ANTHROPIC_API_KEY ? 'active' : 'pending'}
            hint={
              process.env.ANTHROPIC_API_KEY
                ? 'ANTHROPIC_API_KEY cargada. Usá /ia para análisis de piel y protocolos.'
                : 'Cargá ANTHROPIC_API_KEY en Vercel para activar /ia.'
            }
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

function AfipConfigSection({
  provider,
  config,
}: {
  provider: string;
  config: Record<string, unknown> | null;
}) {
  const tfApiKey = (config?.api_key as string) ?? '';
  const tfApiToken = (config?.api_token as string) ?? '';
  const tfUserToken = (config?.user_token as string) ?? '';
  const pos = (config?.point_of_sale as number) ?? 1;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="mb-2 text-lg font-semibold">AFIP — Facturación electrónica</h2>
      <p className="mb-4 text-sm text-stone-500">
        Cada centro carga sus propias credenciales TusFacturas (no son globales).
        Si no querés facturar electrónicamente todavía, dejá &quot;Manual&quot; — emitimos
        comprobantes internos no fiscales.
      </p>
      <form action={saveAfipConfig} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="provider">Proveedor</Label>
          <select
            id="provider"
            name="provider"
            defaultValue={provider}
            className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="manual">Manual (comprobantes internos no fiscales)</option>
            <option value="tusfacturas">TusFacturas API (facturación AFIP real)</option>
          </select>
        </div>

        <details className="rounded-lg border border-stone-200 p-3" open={provider === 'tusfacturas'}>
          <summary className="cursor-pointer text-sm font-medium">
            Credenciales TusFacturas (solo si seleccionás &quot;TusFacturas&quot;)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-stone-500">
              Las obtenés de tu cuenta en{' '}
              <a
                href="https://tusfacturas.app"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                tusfacturas.app
              </a>{' '}
              → Mi cuenta → API. Se guardan cifradas.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="api_key">API Key</Label>
                <Input id="api_key" name="api_key" type="password" defaultValue={tfApiKey} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api_token">API Token</Label>
                <Input id="api_token" name="api_token" type="password" defaultValue={tfApiToken} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user_token">User Token</Label>
                <Input
                  id="user_token"
                  name="user_token"
                  type="password"
                  defaultValue={tfUserToken}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="point_of_sale">Punto de venta</Label>
                <Input id="point_of_sale" name="point_of_sale" type="number" min={1} defaultValue={pos} />
              </div>
            </div>
          </div>
        </details>

        <div className="flex justify-end">
          <SubmitButton pendingText="Guardando...">Guardar config AFIP</SubmitButton>
        </div>
      </form>
    </section>
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
