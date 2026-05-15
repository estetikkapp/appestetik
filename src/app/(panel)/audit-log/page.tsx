import { cookies } from 'next/headers';
import { History } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTimeAr } from '@/lib/utils/dates';

export const metadata = { title: 'Audit log — appestetika' };

const ACTION_LABELS: Record<string, string> = {
  'appointment.create.public': 'Reserva pública',
  'appointment.cancel.public': 'Cancelación clienta',
  'appointment.cancel': 'Cancelación staff',
  'appointment.create': 'Turno creado',
  'closure.apply': 'Cierre aplicado',
  'closure.delete': 'Cierre eliminado',
  'service.delete': 'Servicio eliminado',
  'package.assign': 'Paquete asignado',
  'payment.refund': 'Pago devuelto',
};

async function loadData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return [];

  // OJO: no joinear con memberships acá — no hay FK entre audit_log
  // y memberships, PostgREST falla con PGRST200 y la query devuelve null.
  // El JSX solo usa actor_label y actor_user_id, no necesita el join.
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  return data ?? [];
}

export default async function AuditLogPage() {
  await requireMembership({ minRole: 'admin' });
  const log = await loadData();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <History className="h-6 w-6 text-brand-500" />
          Audit log
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Últimas 200 acciones registradas. Solo visible para owner/admin.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuándo</TableHead>
              <TableHead>Quién</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {log.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-stone-400">
                  Sin actividad registrada todavía.
                </TableCell>
              </TableRow>
            )}
            {log.map((row) => {
              const payload = row.payload as Record<string, unknown> | null;
              const summary = payload && Object.keys(payload).length > 0
                ? Object.entries(payload)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                    .join(' · ')
                : '—';
              return (
                <TableRow key={row.id}>
                  <TableCell className="text-xs tabular-nums text-stone-600">
                    {formatDateTimeAr(row.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.actor_label ? (
                      <Badge variant="secondary">{row.actor_label}</Badge>
                    ) : row.actor_user_id ? (
                      <span className="text-stone-700">staff</span>
                    ) : (
                      <span className="text-stone-400">sistema</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge>{ACTION_LABELS[row.action] ?? row.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-stone-600">
                    {row.entity_type}
                    {row.entity_id && (
                      <span className="ml-1 text-stone-400">{row.entity_id.slice(0, 8)}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs text-stone-500" title={summary}>
                    {summary}
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
