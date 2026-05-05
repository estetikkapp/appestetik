import { cookies } from 'next/headers';
import { CalendarOff, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dryRunClosure, applyClosure, deleteClosure } from '@/actions/closures';
import { formatDateTimeAr } from '@/lib/utils/dates';

export const metadata = { title: 'Cierres — appestetika' };

async function loadData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [blocksResult, profsResult] = await Promise.all([
    supabase
      .from('schedule_blocks')
      .select('*')
      .eq('organization_id', orgId)
      .order('starts_at', { ascending: false })
      .limit(50),
    supabase
      .from('memberships')
      .select('user_id, display_name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'professional']),
  ]);

  return {
    blocks: blocksResult.data ?? [],
    professionals: (profsResult.data ?? []).filter((p) => !!p.user_id),
  };
}

export default async function CierresPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    ok?: string;
    affected?: string;
    preview?: string;
    starts_at?: string;
    ends_at?: string;
    reason?: string;
    professional_id?: string;
    all_day?: string;
  };
}) {
  const data = await loadData();
  if (!data) return <div className="text-sm text-stone-500">Sin organización activa.</div>;
  const { blocks, professionals } = data;

  const isPreview = searchParams.preview === '1';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <CalendarOff className="h-6 w-6 text-brand-500" />
          Cierres y bloqueos
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Vacaciones, feriados, mantenimiento. Al aplicar un cierre, los turnos pendientes
          dentro del rango quedan cancelados y la clienta recibe aviso por WhatsApp.
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok === 'aplicado' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Cierre aplicado. {searchParams.affected ?? 0} turnos cancelados y notificados.
        </div>
      )}
      {searchParams.ok === 'eliminado' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Cierre eliminado.
        </div>
      )}

      {!isPreview ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Crear cierre</h2>
          <form action={dryRunClosure} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="starts_at">Desde *</Label>
                <Input id="starts_at" name="starts_at" type="datetime-local" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ends_at">Hasta *</Label>
                <Input id="ends_at" name="ends_at" type="datetime-local" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professional_id">Aplica a</Label>
              <select
                id="professional_id"
                name="professional_id"
                defaultValue=""
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">Todo el centro</option>
                {professionals.map((p) => (
                  <option key={p.user_id} value={p.user_id ?? ''}>
                    {p.display_name ?? 'Sin nombre'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Motivo *</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                minLength={3}
                rows={2}
                placeholder="Ej. Feriado nacional, vacaciones de María, mantenimiento de máquina..."
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 p-3">
              <input
                type="checkbox"
                name="all_day"
                defaultChecked
                className="h-4 w-4 accent-brand-500"
              />
              <span className="text-sm">Día completo (afecta todo el horario del rango)</span>
            </label>
            <div className="flex justify-end">
              <SubmitButton pendingText="Calculando...">Continuar</SubmitButton>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-amber-900">Confirmar cierre</h2>
              <p className="text-sm text-amber-800">
                Vas a cancelar <strong>{searchParams.affected ?? 0}</strong> turnos. Cada
                clienta recibirá un mensaje de WhatsApp con el motivo. Esta acción NO se
                puede deshacer (los turnos quedarán como cancelados).
              </p>
            </div>
          </div>

          <dl className="mb-6 grid gap-2 rounded-lg bg-white/60 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-stone-700">Desde</dt>
              <dd>{searchParams.starts_at && formatDateTimeAr(searchParams.starts_at)}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-700">Hasta</dt>
              <dd>{searchParams.ends_at && formatDateTimeAr(searchParams.ends_at)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-stone-700">Motivo</dt>
              <dd>{searchParams.reason}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-700">Profesional</dt>
              <dd>
                {searchParams.professional_id
                  ? professionals.find((p) => p.user_id === searchParams.professional_id)?.display_name ?? 'Profesional específica'
                  : 'Todo el centro'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-700">Día completo</dt>
              <dd>{searchParams.all_day === 'true' ? 'Sí' : 'No'}</dd>
            </div>
          </dl>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <a href="/cierres">Cancelar</a>
            </Button>
            <form action={applyClosure}>
              <input type="hidden" name="starts_at" value={searchParams.starts_at} />
              <input type="hidden" name="ends_at" value={searchParams.ends_at} />
              <input type="hidden" name="reason" value={searchParams.reason} />
              {searchParams.professional_id && (
                <input type="hidden" name="professional_id" value={searchParams.professional_id} />
              )}
              {searchParams.all_day === 'true' && (
                <input type="hidden" name="all_day" value="on" />
              )}
              <SubmitButton variant="destructive" pendingText="Aplicando...">
                Sí, aplicar y cancelar turnos
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-stone-700">Cierres existentes</h2>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rango</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-stone-400">
                    No hay cierres registrados.
                  </TableCell>
                </TableRow>
              )}
              {blocks.map((b) => {
                const ended = new Date(b.ends_at).getTime() < Date.now();
                const profMatch = professionals.find((p) => p.user_id === b.professional_id);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs tabular-nums">
                      {formatDateTimeAr(b.starts_at)}
                      <br />
                      <span className="text-stone-400">→</span> {formatDateTimeAr(b.ends_at)}
                    </TableCell>
                    <TableCell className="text-sm">{b.reason}</TableCell>
                    <TableCell className="text-sm text-stone-600">
                      {b.professional_id
                        ? profMatch?.display_name ?? 'Específica'
                        : 'Todo el centro'}
                    </TableCell>
                    <TableCell>
                      {ended ? (
                        <Badge variant="secondary">Pasado</Badge>
                      ) : new Date(b.starts_at).getTime() > Date.now() ? (
                        <Badge variant="outline">Futuro</Badge>
                      ) : (
                        <Badge variant="destructive">En curso</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteConfirmButton
                        action={deleteClosure}
                        id={b.id}
                        itemLabel="este cierre"
                        description="Eliminar el cierre NO restaura los turnos cancelados — eso queda manual."
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
