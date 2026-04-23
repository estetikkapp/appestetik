import { cookies } from 'next/headers';
import { CalendarPlus, Users, Scissors, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Inicio — appestetika' };

async function loadDashboardData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: membership }, { count: clientsCount }, { count: servicesCount }] = await Promise.all([
    supabase
      .from('memberships')
      .select('display_name, organizations(name, trial_ends_at)')
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
  ]);

  return { membership, clientsCount: clientsCount ?? 0, servicesCount: servicesCount ?? 0 };
}

export default async function DashboardPage() {
  const data = await loadDashboardData();
  const orgRel = data?.membership?.organizations;
  const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
  const displayName = data?.membership?.display_name ?? 'tu';
  const orgName = org?.name ?? 'tu centro';

  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Hola, {displayName} 👋</h1>
        <p className="mt-1 text-sm text-stone-500">
          Bienvenida al panel de <strong>{orgName}</strong>.
        </p>
      </div>

      {trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="rounded-xl border border-gold-400/40 bg-gold-500/5 p-4 text-sm text-gold-600">
          <strong>Período de prueba:</strong> te quedan {trialDaysLeft} días para probar todas las
          funciones gratis.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Clientas"
          value={data?.clientsCount ?? 0}
          hint="Total registradas"
        />
        <StatCard
          icon={Scissors}
          label="Servicios activos"
          value={data?.servicesCount ?? 0}
          hint="En catálogo"
        />
        <StatCard icon={CalendarPlus} label="Turnos hoy" value="—" hint="Sprint 2" />
        <StatCard icon={TrendingUp} label="Facturación mes" value="—" hint="Sprint 3" />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-stone-900">Próximamente</h2>
        <p className="mt-2 text-sm text-stone-500">
          La vista de agenda con calendario día/semana/mes llega en el Sprint 2.
        </p>
        <Button variant="outline" className="mt-4" disabled>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Crear primer turno
        </Button>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
}

function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-stone-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-xs text-stone-400">{hint}</p>
    </div>
  );
}
