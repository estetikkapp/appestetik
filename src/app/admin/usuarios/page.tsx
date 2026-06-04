import { Users, CheckCircle2, AlertCircle, Activity, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { loadPlatformUsers, type PlatformUserRow } from '@/lib/admin/platform-users';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuarios — admin appestetika' };

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

export default async function AdminUsersPage() {
  const { overview, users } = await loadPlatformUsers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Usuarios</h1>
        <p className="mt-1 text-sm text-stone-500">
          Todas las personas registradas en appestetika (dueñas, empleadas, etc.).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Usuarios totales"
          value={overview.totalUsers}
          sub={`${Object.values(overview.byRole).reduce((a, b) => a + b, 0)} membresías`}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Email confirmado"
          value={`${overview.confirmedUsers}/${overview.totalUsers}`}
          sub={`${overview.unconfirmedUsers} sin confirmar`}
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-brand-600" />}
          label="Activos (30d)"
          value={overview.activeLast30d}
          sub="con login reciente"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          label="Altas esta semana"
          value={overview.newThisWeek}
          sub={`${overview.newThisMonth} este mes`}
        />
        {overview.usersWithoutOrg > 0 && (
          <StatCard
            icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
            label="Sin organización"
            value={overview.usersWithoutOrg}
            sub="cuentas sin clínica asignada"
          />
        )}
      </div>

      {/* Distribución por rol */}
      {Object.keys(overview.byRole).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(overview.byRole).map(([role, count]) => (
            <div
              key={role}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm"
            >
              <span className="font-medium capitalize">{role}</span>
              <span className="ml-2 text-stone-500">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-stone-900">
          Listado ({users.length}{users.length !== overview.totalUsers && ` membresías · ${overview.totalUsers} únicos`})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-stone-400">
                    No hay usuarios registrados todavía.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u, i) => (
                <UserRow key={`${u.user_id}-${u.membership_id ?? i}`} u={u} />
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

function UserRow({ u }: { u: PlatformUserRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-stone-900">{u.email}</div>
        {u.display_name && (
          <div className="text-xs text-stone-500">{u.display_name}</div>
        )}
      </TableCell>
      <TableCell className="text-xs text-stone-500">{fmtDate(u.created_at)}</TableCell>
      <TableCell>
        {u.org_name ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{u.org_name}</span>
            {u.org_slug && (
              <span className="text-xs text-stone-400">/c/{u.org_slug}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-stone-400">sin org</span>
        )}
      </TableCell>
      <TableCell>
        {u.role ? (
          <Badge variant={u.role === 'owner' ? 'default' : 'outline'} className="text-[10px] capitalize">
            {u.role}
          </Badge>
        ) : (
          <span className="text-xs text-stone-400">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {u.email_confirmed_at ? (
            <Badge variant="success" className="w-fit text-[10px]">
              ✓ Confirmado
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit text-[10px]">
              Sin confirmar
            </Badge>
          )}
          {u.membership_active === false && (
            <Badge variant="destructive" className="w-fit text-[10px]">
              Membresía inactiva
            </Badge>
          )}
          {u.invitation_accepted_at && (
            <span className="text-[10px] text-stone-400">aceptó invit.</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-stone-500">
        {relativeTime(u.last_sign_in_at)}
      </TableCell>
    </TableRow>
  );
}
