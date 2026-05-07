import { cookies } from 'next/headers';
import { ExternalLink } from 'lucide-react';
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
import { formatArs } from '@/lib/utils/format-ars';
import { formatDateTimeAr } from '@/lib/utils/dates';
import { CobrosClient } from './cobros-client';

export const metadata = { title: 'Cobros — appestetika' };

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  mp_card: 'MP tarjeta',
  mp_link: 'Link MP',
  transfer: 'Transferencia',
  package_credit: 'Paquete',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'destructive' | 'secondary' | 'outline'> = {
  pending: 'outline',
  approved: 'success',
  rejected: 'destructive',
  refunded: 'secondary',
  cancelled: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Cobrado',
  rejected: 'Rechazado',
  refunded: 'Devuelto',
  cancelled: 'Cancelado',
};

async function loadData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [paymentsResult, clientsResult, mpEnabledResult, orgResult] = await Promise.all([
    supabase
      .from('payments')
      .select('*, client:clients(id, full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('clients')
      .select('id, full_name, email')
      .eq('organization_id', orgId)
      .order('full_name')
      .limit(500),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('method', 'mp_link'),
    // MP ahora es per-org: leer mp_config de la organization. La env var
    // global MP_ACCESS_TOKEN ya no se usa (se removió en el cambio per-org).
    supabase
      .from('organizations')
      .select('mp_config')
      .eq('id', orgId)
      .maybeSingle(),
  ]);

  const mpCfg = orgResult.data?.mp_config as { access_token?: string } | null;
  const mpConfigured =
    !!mpCfg?.access_token && !mpCfg.access_token.startsWith('placeholder');

  return {
    payments: paymentsResult.data ?? [],
    clients: clientsResult.data ?? [],
    mpConfigured,
    mpUsageCount: mpEnabledResult.count ?? 0,
  };
}

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const data = await loadData();
  if (!data) {
    return <div className="text-sm text-stone-500">Sin organización activa.</div>;
  }
  const { payments, clients, mpConfigured } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Cobros</h1>
          <p className="mt-1 text-sm text-stone-500">
            Pagos recibidos. Registrá efectivos, transferencias o creá links de MP.
          </p>
        </div>
        <CobrosClient clients={clients} mpConfigured={mpConfigured} />
      </div>

      {!mpConfigured && (
        <div className="rounded-xl border border-gold-400/40 bg-gold-500/5 p-4 text-sm text-gold-700">
          <strong>Mercado Pago no configurado todavía.</strong> Para crear links de pago necesitás
          cargar tu Access Token MP en{' '}
          <a href="/configuracion" className="font-medium underline">
            Configuración → Mercado Pago
          </a>
          . El registro manual de pagos (efectivo/transferencia) funciona igual sin esto.
        </div>
      )}

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok === 'registrado' && 'Pago registrado.'}
          {searchParams.ok === 'link-creado' && 'Link de MP creado y guardado.'}
          {searchParams.ok === 'devuelto' && 'Pago marcado como devuelto.'}
          {searchParams.ok === 'mp-success' && '✓ Pago aprobado por Mercado Pago.'}
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clienta</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-stone-400">
                  No hay pagos registrados.
                </TableCell>
              </TableRow>
            )}
            {payments.map((p) => {
              const cli = Array.isArray(p.client) ? p.client[0] : p.client;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{cli?.full_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{METHOD_LABELS[p.method] ?? p.method}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatArs(Number(p.amount_ars))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[p.status]}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-stone-500">
                    {p.paid_at
                      ? formatDateTimeAr(p.paid_at)
                      : formatDateTimeAr(p.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.mp_payment_link && (
                      <a
                        href={p.mp_payment_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Link MP
                      </a>
                    )}
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
