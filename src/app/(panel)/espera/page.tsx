import { cookies } from 'next/headers';
import { ListChecks, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateAr, formatDateTimeAr } from '@/lib/utils/dates';
import { WaitlistAddDialog } from './waitlist-add-dialog';
import { WaitlistRowActions } from './waitlist-row-actions';

export const metadata = { title: 'Lista de espera — appestetika' };

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'destructive' | 'secondary' | 'outline'> = {
  waiting: 'outline',
  notified: 'default',
  booked: 'success',
  cancelled: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Esperando',
  notified: 'Avisada',
  booked: 'Reservada',
  cancelled: 'Cancelada',
};

async function loadData(filterStatus: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  let entriesQuery = supabase
    .from('waitlist_entries')
    .select(
      `id, status, preferred_date, notes, notified_at, created_at,
       client:clients(id, full_name, phone_e164),
       service:services(id, name)`
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filterStatus !== 'all') {
    entriesQuery = entriesQuery.eq(
      'status',
      filterStatus as 'waiting' | 'notified' | 'booked' | 'cancelled'
    );
  }

  const [entriesResult, clientsResult, servicesResult, orgResult] = await Promise.all([
    entriesQuery,
    supabase
      .from('clients')
      .select('id, full_name, phone_e164')
      .eq('organization_id', orgId)
      .order('full_name')
      .limit(1000),
    supabase
      .from('services')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('organizations')
      .select('whatsapp_status')
      .eq('id', orgId)
      .maybeSingle(),
  ]);

  return {
    entries: entriesResult.data ?? [],
    clients: clientsResult.data ?? [],
    services: servicesResult.data ?? [],
    whatsappConnected: orgResult.data?.whatsapp_status === 'connected',
  };
}

export default async function EsperaPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; status?: string };
}) {
  const filterStatus = searchParams.status ?? 'waiting';
  const data = await loadData(filterStatus);
  if (!data) return <div className="text-sm text-stone-500">Sin organización activa.</div>;

  const { entries, clients, services, whatsappConnected } = data;

  const counts = entries.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <ListChecks className="h-6 w-6 text-brand-500" />
            Lista de espera
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Clientas que esperan turno cuando se libere uno. Avisales en un click cuando aparezca un hueco.
          </p>
        </div>
        <WaitlistAddDialog clients={clients} services={services} />
      </div>

      {!whatsappConnected && (
        <div className="rounded-xl border border-gold-400/40 bg-gold-500/5 p-4 text-sm text-gold-700">
          <strong>WhatsApp no conectado.</strong> Las notificaciones se marcarán como manuales —
          tendrás que llamar o escribir vos. Conectá WhatsApp en{' '}
          <a href="/configuracion" className="underline">
            Configuración
          </a>{' '}
          para automatizar.
        </div>
      )}

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok === 'agregada' && 'Clienta agregada a la lista de espera.'}
          {searchParams.ok === 'notificada' && 'Aviso enviado por WhatsApp.'}
          {searchParams.ok === 'marcada+manual' && 'Marcada como avisada (manual).'}
          {searchParams.ok === 'reservada' && 'Marcada como reservada.'}
          {searchParams.ok === 'cancelada' && 'Entrada cancelada.'}
          {searchParams.ok === 'eliminada' && 'Entrada eliminada.'}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['waiting', 'notified', 'booked', 'cancelled', 'all'] as const).map((s) => {
          const count = s === 'all' ? null : counts[s] ?? 0;
          const isActive = filterStatus === s;
          const label = s === 'all' ? 'Todas' : STATUS_LABELS[s];
          return (
            <a
              key={s}
              href={`/espera?status=${s}`}
              className={`inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-100 text-brand-800 font-medium'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {label}
              {count !== null && (
                <span className={`ml-1 text-xs ${isActive ? 'text-brand-600' : 'text-stone-400'}`}>
                  ({count})
                </span>
              )}
            </a>
          );
        })}
      </div>

      {/* Mobile: tarjetas */}
      <div className="space-y-3 md:hidden">
        {entries.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-center text-sm text-stone-400">
            No hay entradas para este filtro.
          </div>
        )}
        {entries.map((e) => {
          const cli = Array.isArray(e.client) ? e.client[0] : e.client;
          const svc = Array.isArray(e.service) ? e.service[0] : e.service;
          return (
            <div
              key={e.id}
              className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
            >
              <div>
                <div className="font-medium text-stone-900">{cli?.full_name ?? '—'}</div>
                <div className="text-xs text-stone-500">
                  {cli?.phone_e164 ?? 'sin teléfono'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-stone-600">{svc?.name ?? '—'}</span>
                <Badge variant={STATUS_VARIANTS[e.status]}>
                  {STATUS_LABELS[e.status] ?? e.status}
                </Badge>
              </div>
              <div className="text-sm text-stone-600">
                <span className="text-stone-400">Fecha preferida: </span>
                {e.preferred_date ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateAr(e.preferred_date)}
                  </span>
                ) : (
                  <span className="text-stone-400">cualquiera</span>
                )}
              </div>
              <div className="text-xs text-stone-500">
                <span className="text-stone-400">Antigüedad: </span>
                {formatDateTimeAr(e.created_at)}
                {e.notified_at && (
                  <span className="ml-2 text-stone-400">
                    · avisada {formatDateTimeAr(e.notified_at)}
                  </span>
                )}
              </div>
              <div className="pt-1">
                <WaitlistRowActions
                  id={e.id}
                  status={e.status}
                  clientName={cli?.full_name ?? ''}
                  serviceName={svc?.name ?? ''}
                  hasPhone={!!cli?.phone_e164}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden rounded-xl border border-stone-200 bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clienta</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Fecha preferida</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Antigüedad</TableHead>
              <TableHead className="w-40 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-stone-400">
                  No hay entradas para este filtro.
                </TableCell>
              </TableRow>
            )}
            {entries.map((e) => {
              const cli = Array.isArray(e.client) ? e.client[0] : e.client;
              const svc = Array.isArray(e.service) ? e.service[0] : e.service;
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-medium text-stone-900">{cli?.full_name ?? '—'}</div>
                    <div className="text-xs text-stone-500">{cli?.phone_e164 ?? 'sin teléfono'}</div>
                  </TableCell>
                  <TableCell className="text-sm">{svc?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-stone-600">
                    {e.preferred_date ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateAr(e.preferred_date)}
                      </span>
                    ) : (
                      <span className="text-stone-400">cualquiera</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[e.status]}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                    {e.notified_at && (
                      <div className="mt-1 text-[10px] text-stone-400">
                        avisada {formatDateTimeAr(e.notified_at)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-stone-500">
                    {formatDateTimeAr(e.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <WaitlistRowActions
                      id={e.id}
                      status={e.status}
                      clientName={cli?.full_name ?? ''}
                      serviceName={svc?.name ?? ''}
                      hasPhone={!!cli?.phone_e164}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
