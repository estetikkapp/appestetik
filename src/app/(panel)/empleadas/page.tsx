import { cookies } from 'next/headers';
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
import { formatDateAr } from '@/lib/utils/dates';
import { EmpleadasClient } from './empleadas-client';

export const metadata = { title: 'Empleadas — appestetika' };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  professional: 'Profesional',
  receptionist: 'Recepción',
};

async function loadData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return { memberships: [], invitations: [], templates: [], services: [], proServices: [] };

  const [
    membershipsResult,
    invitationsResult,
    templatesResult,
    servicesResult,
    proServicesResult,
  ] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, role, display_name, active, created_at, user_id, schedule_template_id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', orgId)
      .is('accepted_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('schedule_templates')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('services')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('professional_services')
      .select('membership_id, service_id')
      .eq('organization_id', orgId),
  ]);

  return {
    memberships: membershipsResult.data ?? [],
    invitations: invitationsResult.data ?? [],
    templates: templatesResult.data ?? [],
    services: servicesResult.data ?? [],
    proServices: proServicesResult.data ?? [],
  };
}

export default async function EmpleadasPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  await requireMembership({ minRole: 'admin' });
  const { memberships, invitations, templates, services, proServices } = await loadData();
  const proServicesByMembership = new Map<string, string[]>();
  for (const ps of proServices) {
    const arr = proServicesByMembership.get(ps.membership_id) ?? [];
    arr.push(ps.service_id);
    proServicesByMembership.set(ps.membership_id, arr);
  }
  const templateById = new Map(templates.map((t) => [t.id, t.name]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Empleadas</h1>
          <p className="mt-1 text-sm text-stone-500">
            Personas con acceso al panel de tu centro.
          </p>
        </div>
        <EmpleadasClient mode="invite" />
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok === 'invitada' && 'Invitación enviada por email.'}
          {searchParams.ok === 'reenviada' && 'Email de invitación reenviado.'}
          {searchParams.ok === 'revocada' && 'Invitación revocada.'}
          {searchParams.ok === 'eliminada' && 'Empleada eliminada.'}
          {searchParams.ok === 'plantilla-asignada' && 'Plantilla de horarios asignada.'}
          {searchParams.ok === 'servicios-asignados' && 'Servicios asignados.'}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-stone-700">Activas</h2>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Plantilla</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-44 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-stone-400">
                    No hay empleadas cargadas.
                  </TableCell>
                </TableRow>
              )}
              {memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.display_name ?? <span className="text-stone-400">Sin nombre</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'owner' ? 'premium' : 'default'}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-stone-600">
                    {m.schedule_template_id
                      ? templateById.get(m.schedule_template_id) ?? '—'
                      : <span className="text-stone-400">Sin plantilla</span>}
                  </TableCell>
                  <TableCell className="text-sm text-stone-600">
                    {(() => {
                      const list = proServicesByMembership.get(m.id) ?? [];
                      if (list.length === 0) return <span className="text-stone-400">Todos</span>;
                      return `${list.length} asignados`;
                    })()}
                  </TableCell>
                  <TableCell>
                    {m.active ? (
                      <Badge variant="success">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EmpleadasClient
                        mode="config"
                        membership={m}
                        templates={templates}
                        services={services}
                        assignedServiceIds={proServicesByMembership.get(m.id) ?? []}
                      />
                      {m.role !== 'owner' && (
                        <EmpleadasClient mode="toggle" membership={m} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-stone-700">Invitaciones pendientes</h2>
          <div className="rounded-xl border border-stone-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{ROLE_LABELS[inv.role] ?? inv.role}</TableCell>
                    <TableCell className="text-sm text-stone-600">
                      {formatDateAr(inv.expires_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <EmpleadasClient mode="revoke" invitation={inv} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
