import { cookies } from 'next/headers';
import { Sparkles, Camera, Workflow } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { Badge } from '@/components/ui/badge';
import { runSkinAnalysis, runProtocolGeneration } from '@/actions/ai';
import { formatDateTimeAr } from '@/lib/utils/dates';

export const metadata = { title: 'IA — appestetika' };

async function loadData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [{ data: clients }, { data: analyses }, { data: protocols }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name')
      .eq('organization_id', orgId)
      .order('full_name')
      .limit(500),
    supabase
      .from('skin_analyses')
      .select('id, created_at, client:clients(full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('treatment_protocols')
      .select('id, objective, total_sessions, total_price_ars, status, created_at, client:clients(full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const aiConfigured =
    !!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('placeholder');

  return {
    clients: clients ?? [],
    analyses: analyses ?? [],
    protocols: protocols ?? [],
    aiConfigured,
  };
}

export default async function IaPage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const data = await loadData();
  if (!data) return <div className="text-sm text-stone-500">Sin organización activa.</div>;
  const { clients, analyses, protocols, aiConfigured } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <Sparkles className="h-6 w-6 text-gold-500" />
          IA estética
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Análisis de piel y generador de protocolos personalizados con Claude.
        </p>
      </div>

      {!aiConfigured && (
        <div className="rounded-xl border border-gold-400/40 bg-gold-500/5 p-4 text-sm text-gold-700">
          <strong>IA no configurada todavía.</strong> Cargá{' '}
          <code className="rounded bg-gold-500/10 px-1">ANTHROPIC_API_KEY</code> en Vercel → Project
          Settings → Environment Variables. Mientras tanto los formularios están deshabilitados.
        </div>
      )}

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok.startsWith('skin-analysis') && '✓ Análisis de piel completado.'}
          {searchParams.ok === 'protocol-generated' && '✓ Protocolo generado.'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Camera className="h-5 w-5 text-brand-500" />
            Diagnóstico de piel
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Subí una foto frontal con buena iluminación. La IA analiza hidratación, manchas,
            arrugas, poros, rojeces, acné y elasticidad.
          </p>
          <form action={runSkinAnalysis} encType="multipart/form-data" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa_client">Clienta *</Label>
              <select
                id="sa_client"
                name="client_id"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
              >
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sa_age">Edad</Label>
                <Input id="sa_age" name="client_age" type="number" min={1} max={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sa_obj">Objetivo</Label>
                <Input id="sa_obj" name="objective" placeholder="Ej. anti-age" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa_photo">Foto frontal *</Label>
              <input
                id="sa_photo"
                name="photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base file:mr-3 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-700 sm:text-sm"
              />
            </div>
            <div className="flex justify-end pt-2">
              <SubmitButton disabled={!aiConfigured} pendingText="Analizando (15-30s)...">
                <Sparkles className="mr-2 h-4 w-4" />
                Analizar piel
              </SubmitButton>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Workflow className="h-5 w-5 text-brand-500" />
            Generador de protocolos
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Convertí una consulta informal en un protocolo estructurado con fases, sesiones y
            cronograma. Aumenta el ticket promedio 2-3x.
          </p>
          <form action={runProtocolGeneration} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pg_client">Clienta *</Label>
              <select
                id="pg_client"
                name="client_id"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
              >
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg_obj">Objetivo principal *</Label>
              <select
                id="pg_obj"
                name="main_objective"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
              >
                <option value="">Seleccionar</option>
                <option value="anti-age">Anti-age / rejuvenecimiento</option>
                <option value="manchas">Reducción de manchas</option>
                <option value="acne">Tratamiento de acné</option>
                <option value="hidratacion">Hidratación profunda</option>
                <option value="reduccion-medidas">Reducción de medidas</option>
                <option value="depilacion-definitiva">Depilación definitiva</option>
                <option value="firmeza">Firmeza / lifting no quirúrgico</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pg_budget">Presupuesto</Label>
                <select
                  id="pg_budget"
                  name="budget_range"
                  defaultValue=""
                  className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
                >
                  <option value="">No declarado</option>
                  <option value="bajo">Bajo (&lt; $80.000)</option>
                  <option value="medio">Medio ($80.000-$300.000)</option>
                  <option value="alto">Alto (&gt; $300.000)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg_avail">Disponibilidad</Label>
                <select
                  id="pg_avail"
                  name="availability"
                  defaultValue="biweekly"
                  className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
                >
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Cada 15 días</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pg_contra">Contraindicaciones</Label>
              <Textarea id="pg_contra" name="contraindications" rows={2} placeholder="Opcional" />
            </div>
            <div className="flex justify-end pt-2">
              <SubmitButton disabled={!aiConfigured} pendingText="Generando protocolo...">
                <Sparkles className="mr-2 h-4 w-4" />
                Generar protocolo
              </SubmitButton>
            </div>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Análisis recientes</h2>
        {analyses.length === 0 ? (
          <p className="text-sm text-stone-400">Aún no se realizaron análisis.</p>
        ) : (
          <ul className="space-y-2">
            {analyses.map((a) => {
              const cli = Array.isArray(a.client) ? a.client[0] : a.client;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 p-3 text-sm"
                >
                  <div className="min-w-0 truncate">
                    <span className="font-medium">{cli?.full_name ?? '—'}</span>
                    <span className="ml-2 text-xs text-stone-500">{formatDateTimeAr(a.created_at)}</span>
                  </div>
                  <Badge variant="premium" className="shrink-0">Análisis IA</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Protocolos generados</h2>
        {protocols.length === 0 ? (
          <p className="text-sm text-stone-400">Aún no se generaron protocolos.</p>
        ) : (
          <ul className="space-y-2">
            {protocols.map((p) => {
              const cli = Array.isArray(p.client) ? p.client[0] : p.client;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{cli?.full_name ?? '—'}</div>
                    <div className="truncate text-xs text-stone-500">
                      {p.objective} · {p.total_sessions} sesiones · ${p.total_price_ars?.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <Badge className="shrink-0">{p.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
