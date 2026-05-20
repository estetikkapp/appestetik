import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  CalendarPlus,
  Users,
  Scissors,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatArs } from '@/lib/utils/format-ars';
import { formatDateTimeAr } from '@/lib/utils/dates';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@/types/app';

export const metadata = { title: 'Inicio — appestetika' };

function startOfMonthAr(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3, 0, 0)).toISOString();
}

function startOfDayAr(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  return d.toISOString();
}

function endOfDayAr(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 3, 0, 0));
  return d.toISOString();
}

async function loadDashboardData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const monthStart = startOfMonthAr();
  const dayStart = startOfDayAr();
  const dayEnd = endOfDayAr();

  const [
    { data: membership },
    { count: clientsCount },
    { count: servicesCount },
    { data: todayAppointments },
    { data: monthAppointments },
    { data: monthPayments },
    { data: recentClients },
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select('display_name, organizations(name)')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('active', true),
    supabase
      .from('appointments')
      .select('id, starts_at, status, client:clients(full_name), service:services(name, price_ars)')
      .eq('organization_id', orgId)
      .gte('starts_at', dayStart)
      .lt('starts_at', dayEnd)
      .order('starts_at'),
    supabase
      .from('appointments')
      .select('id, status, service:services(name, price_ars)')
      .eq('organization_id', orgId)
      .gte('starts_at', monthStart),
    supabase
      .from('payments')
      .select('amount_ars, status, paid_at')
      .eq('organization_id', orgId)
      .gte('created_at', monthStart),
    supabase
      .from('clients')
      .select('id, full_name, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Calcular tasa de ausentismo
  const completed = monthAppointments?.filter((a) => a.status === 'completed').length ?? 0;
  const noShow = monthAppointments?.filter((a) => a.status === 'no_show').length ?? 0;
  const cancelled = monthAppointments?.filter((a) => a.status === 'cancelled').length ?? 0;
  const totalScheduled = (monthAppointments?.length ?? 0) - cancelled;
  const ausentismoRate = totalScheduled > 0 ? (noShow / totalScheduled) * 100 : 0;

  // Facturación del mes (sumar payments approved + servicios completed sin payment)
  const paymentsRevenue = (monthPayments ?? [])
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount_ars), 0);

  // Estimación de revenue por turnos completados (cuando no hay payment trackeado)
  const completedRevenue = (monthAppointments ?? [])
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => {
      const svc = Array.isArray(a.service) ? a.service[0] : a.service;
      return sum + (svc?.price_ars ? Number(svc.price_ars) : 0);
    }, 0);

  // Ranking de servicios del mes
  const serviceCount: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const a of monthAppointments ?? []) {
    if (a.status !== 'completed') continue;
    const svc = Array.isArray(a.service) ? a.service[0] : a.service;
    if (!svc) continue;
    const key = svc.name;
    if (!serviceCount[key]) serviceCount[key] = { name: svc.name, count: 0, revenue: 0 };
    serviceCount[key].count++;
    serviceCount[key].revenue += Number(svc.price_ars);
  }
  const topServices = Object.values(serviceCount)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    membership,
    clientsCount: clientsCount ?? 0,
    servicesCount: servicesCount ?? 0,
    todayAppointments: todayAppointments ?? [],
    todayCount: todayAppointments?.length ?? 0,
    paymentsRevenue,
    completedRevenue,
    monthRevenue: paymentsRevenue + completedRevenue,
    completed,
    noShow,
    ausentismoRate,
    topServices,
    recentClients: recentClients ?? [],
  };
}

export default async function DashboardPage() {
  const data = await loadDashboardData();
  const orgRel = data?.membership?.organizations;
  const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
  const displayName = data?.membership?.display_name ?? 'tu';
  const orgName = org?.name ?? 'tu centro';

  // TODO Capa 4 (UI): reconstruir banner de trial leyendo plan_subscriptions
  // (status='trialing' + trial_ends_at). Por ahora el banner queda removido;
  // las orgs grandfathered tampoco lo necesitan, y las trial reales todavía
  // no existen (no hay onboarding con plan picker hasta capa 4).

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Hola, {displayName} 👋</h1>
          <p className="mt-1 text-sm text-stone-500">
            Resumen de <strong>{orgName}</strong> · este mes
          </p>
        </div>
        <Button asChild>
          <Link href="/agenda">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Ver agenda
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Facturación mes"
          value={data ? formatArs(data.monthRevenue) : '—'}
          hint={`${data?.completed ?? 0} sesiones completadas`}
          variant="success"
        />
        <StatCard
          icon={Clock}
          label="Turnos hoy"
          value={data?.todayCount ?? 0}
          hint={
            data?.todayCount
              ? `${data.todayAppointments.filter((a) => a.status === 'pending').length} sin confirmar`
              : 'No hay turnos'
          }
        />
        <StatCard
          icon={Users}
          label="Clientas"
          value={data?.clientsCount ?? 0}
          hint={`${data?.recentClients.length ?? 0} nuevas este mes`}
        />
        <StatCard
          icon={AlertCircle}
          label="Ausentismo mes"
          value={data ? `${data.ausentismoRate.toFixed(1)}%` : '—'}
          hint={`${data?.noShow ?? 0} no_show`}
          variant={data && data.ausentismoRate > 15 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Turnos de hoy</h2>
            <Link href="/agenda" className="text-sm text-brand-600 hover:underline">
              Ver agenda →
            </Link>
          </div>
          {data?.todayAppointments.length === 0 ? (
            <p className="text-sm text-stone-400">No hay turnos hoy.</p>
          ) : (
            <ul className="space-y-2">
              {data?.todayAppointments.slice(0, 8).map((a) => {
                const cli = Array.isArray(a.client) ? a.client[0] : a.client;
                const svc = Array.isArray(a.service) ? a.service[0] : a.service;
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-stone-100 p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{cli?.full_name ?? 'Sin clienta'}</div>
                      <div className="text-xs text-stone-500">
                        {formatDateTimeAr(a.starts_at)} · {svc?.name ?? '—'}
                      </div>
                    </div>
                    <Badge
                      variant={
                        a.status === 'completed'
                          ? 'success'
                          : a.status === 'cancelled' || a.status === 'no_show'
                          ? 'destructive'
                          : a.status === 'in_progress'
                          ? 'premium'
                          : 'outline'
                      }
                    >
                      {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top servicios del mes</h2>
            <Scissors className="h-4 w-4 text-stone-400" />
          </div>
          {data?.topServices.length === 0 ? (
            <p className="text-sm text-stone-400">Sin servicios completados aún.</p>
          ) : (
            <ul className="space-y-3">
              {data?.topServices.map((s, idx) => (
                <li key={s.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-stone-500">{s.count} sesiones</div>
                  </div>
                  <span className="text-sm font-medium text-stone-700">{formatArs(s.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Clientas nuevas del mes</h2>
          <Link href="/clientas" className="text-sm text-brand-600 hover:underline">
            Ver todas →
          </Link>
        </div>
        {data?.recentClients.length === 0 ? (
          <p className="text-sm text-stone-400">No hay clientas nuevas este mes.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data?.recentClients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clientas/${c.id}`}
                  className="flex items-center gap-2 rounded-lg border border-stone-100 p-3 text-sm hover:border-brand-300"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  {c.full_name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  variant?: 'default' | 'success' | 'danger';
}

function StatCard({ icon: Icon, label, value, hint, variant = 'default' }: StatCardProps) {
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
