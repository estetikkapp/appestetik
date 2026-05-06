import { cookies } from 'next/headers';
import { BarChart3, Download, TrendingUp, Users, Calendar, Percent } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatArs } from '@/lib/utils/format-ars';

export const metadata = { title: 'Reportes — appestetika' };

function defaultRange(): { from: string; to: string } {
  // últimos 30 días, inclusive hoy
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 29);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

async function loadData(from: string, to: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const fromIso = `${from}T00:00:00-03:00`;
  const toIso = `${to}T23:59:59.999-03:00`;

  const [apptsResult, paymentsResult, clientsCountResult, membersResult] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        `id, starts_at, status, professional_id,
         service:services(id, name, price_ars),
         client:clients(id, full_name)`
      )
      .eq('organization_id', orgId)
      .gte('starts_at', fromIso)
      .lte('starts_at', toIso),
    supabase
      .from('payments')
      .select('id, amount_ars, status, method, paid_at')
      .eq('organization_id', orgId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('memberships')
      .select('user_id, display_name')
      .eq('organization_id', orgId),
  ]);

  const appts = apptsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const newClients = clientsCountResult.count ?? 0;

  // Map prof user_id → display_name
  const profMap = new Map<string, string>();
  for (const m of membersResult.data ?? []) {
    if (m.user_id) profMap.set(m.user_id, m.display_name ?? 'Sin nombre');
  }

  // KPIs
  const completed = appts.filter((a) => a.status === 'completed');
  const noShow = appts.filter((a) => a.status === 'no_show');
  const cancelled = appts.filter((a) => a.status === 'cancelled');
  const totalScheduled = appts.length - cancelled.length;
  const ausentismoRate = totalScheduled > 0 ? (noShow.length / totalScheduled) * 100 : 0;

  const paymentsRevenue = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount_ars), 0);

  const completedRevenue = completed.reduce((sum, a) => {
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    return sum + Number(svc?.price_ars ?? 0);
  }, 0);

  const ticketAvg = completed.length > 0 ? completedRevenue / completed.length : 0;

  // Top servicios
  const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const a of completed) {
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    if (!svc) continue;
    const k = svc.name;
    if (!serviceMap[k]) serviceMap[k] = { name: svc.name, count: 0, revenue: 0 };
    serviceMap[k].count++;
    serviceMap[k].revenue += Number(svc.price_ars ?? 0);
  }
  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Top profesionales
  const profStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const a of completed) {
    if (!a.professional_id) continue;
    const name = profMap.get(a.professional_id) ?? 'Sin asignar';
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    const key = a.professional_id;
    if (!profStats[key]) profStats[key] = { name, count: 0, revenue: 0 };
    profStats[key].count++;
    profStats[key].revenue += Number(svc?.price_ars ?? 0);
  }
  const topProfs = Object.values(profStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Top clientas
  const clientStats: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const a of completed) {
    const cli = Array.isArray(a.client) ? a.client[0] : a.client;
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    if (!cli) continue;
    const key = cli.id;
    if (!clientStats[key]) clientStats[key] = { name: cli.full_name, count: 0, revenue: 0 };
    clientStats[key].count++;
    clientStats[key].revenue += Number(svc?.price_ars ?? 0);
  }
  const topClients = Object.values(clientStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Métodos de pago
  const methodStats: Record<string, { count: number; total: number }> = {};
  for (const p of payments.filter((x) => x.status === 'approved')) {
    const slot = methodStats[p.method] ?? { count: 0, total: 0 };
    slot.count++;
    slot.total += Number(p.amount_ars);
    methodStats[p.method] = slot;
  }

  return {
    completedCount: completed.length,
    noShowCount: noShow.length,
    cancelledCount: cancelled.length,
    appointmentsCount: appts.length,
    ausentismoRate,
    paymentsRevenue,
    completedRevenue,
    totalRevenue: paymentsRevenue + completedRevenue,
    ticketAvg,
    newClients,
    topServices,
    topProfs,
    topClients,
    methodStats,
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const range = defaultRange();
  const from = searchParams.from ?? range.from;
  const to = searchParams.to ?? range.to;

  const data = await loadData(from, to);
  if (!data) return <div className="text-sm text-stone-500">Sin organización activa.</div>;

  const exportUrl = (type: 'appointments' | 'payments' | 'clients') =>
    `/api/reports/export?type=${type}&from=${from}&to=${to}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <BarChart3 className="h-6 w-6 text-brand-500" />
          Reportes
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          KPIs y exportables del centro. Filtrá por rango de fechas.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="space-y-1.5">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={from} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={to} required />
        </div>
        <Button type="submit">Aplicar</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl('appointments')}>
              <Download className="mr-1 h-3 w-3" /> Turnos CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl('payments')}>
              <Download className="mr-1 h-3 w-3" /> Cobros CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl('clients')}>
              <Download className="mr-1 h-3 w-3" /> Clientas CSV
            </a>
          </Button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="Facturación"
          value={formatArs(data.totalRevenue)}
          hint={`${data.completedCount} sesiones`}
          variant="success"
        />
        <Kpi
          icon={Calendar}
          label="Turnos"
          value={data.appointmentsCount}
          hint={`${data.completedCount} completados · ${data.cancelledCount} cancelados`}
        />
        <Kpi
          icon={Percent}
          label="Ausentismo"
          value={`${data.ausentismoRate.toFixed(1)}%`}
          hint={`${data.noShowCount} no_show`}
          variant={data.ausentismoRate > 15 ? 'danger' : 'default'}
        />
        <Kpi
          icon={Users}
          label="Clientas nuevas"
          value={data.newClients}
          hint={`Ticket prom. ${formatArs(data.ticketAvg)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingTable
          title="Top servicios"
          rows={data.topServices.map((s) => ({
            label: s.name,
            count: s.count,
            revenue: s.revenue,
          }))}
        />
        <RankingTable
          title="Top profesionales"
          rows={data.topProfs.map((p) => ({
            label: p.name,
            count: p.count,
            revenue: p.revenue,
          }))}
        />
        <RankingTable
          title="Top clientas"
          rows={data.topClients.map((c) => ({
            label: c.name,
            count: c.count,
            revenue: c.revenue,
          }))}
        />
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Métodos de cobro</h2>
          {Object.keys(data.methodStats).length === 0 ? (
            <p className="text-sm text-stone-400">Sin pagos aprobados en el rango.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.methodStats)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([method, stats]) => (
                    <TableRow key={method}>
                      <TableCell className="font-medium">
                        {METHOD_LABELS[method] ?? method}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{stats.count}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatArs(stats.total)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  mp_card: 'MP tarjeta',
  mp_link: 'Link MP',
  transfer: 'Transferencia',
  package_credit: 'Paquete',
};

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  variant?: 'default' | 'success' | 'danger';
}

function Kpi({ icon: Icon, label, value, hint, variant = 'default' }: KpiProps) {
  const colorClass =
    variant === 'success'
      ? 'text-emerald-600'
      : variant === 'danger'
      ? 'text-red-600'
      : 'text-stone-900';
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-stone-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-stone-400">{hint}</p>
    </div>
  );
}

function RankingTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number; revenue: number }>;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">Sin datos en el rango seleccionado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Sesiones</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={`${r.label}-${idx}`}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatArs(r.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
