import {
  Building2,
  CheckCircle2,
  Activity,
  Moon,
  Clock,
  CreditCard,
  TrendingUp,
  Users,
  CalendarDays,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { loadPlatformStats, type OrgStatRow } from '@/lib/admin/platform-stats';

export const dynamic = 'force-dynamic';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months === 1 ? '' : 'es'}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function AdminDashboardPage() {
  const { overview, orgs } = await loadPlatformStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Resumen de la plataforma</h1>
        <p className="mt-1 text-sm text-stone-500">
          Métricas en tiempo real de todas las clínicas. Solo visible para el equipo.
        </p>
      </div>

      {/* Cards de overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Clínicas totales"
          value={overview.totalOrgs}
          sub={`${overview.onboardedOrgs} completaron onboarding`}
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
          label="Activas (30d)"
          value={overview.activeOrgs30d}
          sub={`${overview.dormantOrgs} dormidas`}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="En trial"
          value={overview.trialing}
          sub={`${overview.activeSubs} pagas · ${overview.noSub} sin plan`}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5 text-brand-600" />}
          label="MRR estimado"
          value={
            overview.estimatedMrr > 0
              ? `$${overview.estimatedMrr.toLocaleString('es-AR')}`
              : '—'
          }
          sub={
            overview.estimatedMrr === 0
              ? 'Cargar precios en PLAN_PRICES_MONTHLY'
              : `${overview.activeSubs} suscripciones`
          }
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          label="Altas esta semana"
          value={overview.newThisWeek}
          sub={`${overview.newThisMonth} este mes`}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Onboarding completo"
          value={`${overview.onboardedOrgs}/${overview.totalOrgs}`}
          sub={`${overview.notOnboardedOrgs} sin terminar`}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Clientas totales"
          value={overview.totalClients.toLocaleString('es-AR')}
          sub="en todas las clínicas"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Turnos totales"
          value={overview.totalAppointments.toLocaleString('es-AR')}
          sub="históricos"
        />
      </div>

      {/* Distribución por plan */}
      {Object.keys(overview.byPlan).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(overview.byPlan).map(([plan, count]) => (
            <div
              key={plan}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm"
            >
              <span className="font-medium capitalize">{plan}</span>
              <span className="ml-2 text-stone-500">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabla de clínicas */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-stone-900">
          Clínicas ({orgs.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clínica</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Serv.</TableHead>
                <TableHead className="text-right">Clientas</TableHead>
                <TableHead className="text-right">Turnos</TableHead>
                <TableHead className="text-right">Equipo</TableHead>
                <TableHead>Integraciones</TableHead>
                <TableHead>Últ. actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-stone-400">
                    No hay clínicas registradas todavía.
                  </TableCell>
                </TableRow>
              )}
              {orgs.map((o) => (
                <OrgRow key={o.org_id} o={o} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-stone-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-stone-900">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

function OrgRow({ o }: { o: OrgStatRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-stone-900">{o.name}</div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          {o.slug ? `/c/${o.slug}` : 'sin slug'}
          {!o.onboarded_at && (
            <Badge variant="secondary" className="text-[10px]">
              sin onboarding
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-stone-500">{fmtDate(o.created_at)}</TableCell>
      <TableCell>
        {o.plan_id ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm capitalize">{o.plan_id}</span>
            <SubStatusBadge status={o.sub_status} />
          </div>
        ) : (
          <span className="text-xs text-stone-400">—</span>
        )}
      </TableCell>
      <TableCell className="text-right text-sm">{o.services_count}</TableCell>
      <TableCell className="text-right text-sm">
        {o.clients_count}
        {o.active_clients_count > 0 && (
          <span className="ml-1 text-xs text-emerald-600">
            ({o.active_clients_count} act.)
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-sm">
        {o.appointments_count}
        {o.appointments_last_30d > 0 && (
          <span className="ml-1 text-xs text-stone-400">
            (+{o.appointments_last_30d})
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-sm">{o.staff_count}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {o.whatsapp_status === 'connected' && (
            <span title="WhatsApp conectado" className="text-xs">📱</span>
          )}
          {o.has_mp && <span title="Mercado Pago" className="text-xs">💳</span>}
          {o.afip_provider === 'tusfacturas' && (
            <span title="AFIP TusFacturas" className="text-xs">🧾</span>
          )}
          {o.whatsapp_status !== 'connected' && !o.has_mp && o.afip_provider !== 'tusfacturas' && (
            <span className="text-xs text-stone-300">—</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-stone-500">
        {relativeTime(o.last_activity_at)}
      </TableCell>
    </TableRow>
  );
}

function SubStatusBadge({ status }: { status: string | null }) {
  if (status === 'active') return <Badge variant="success" className="text-[10px]">paga</Badge>;
  if (status === 'trialing') return <Badge variant="secondary" className="text-[10px]">trial</Badge>;
  if (status === 'cancelled' || status === 'canceled')
    return <Badge variant="destructive" className="text-[10px]">cancelada</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status ?? '—'}</Badge>;
}
