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
import { ResourcesClient } from './resources-client';

export const metadata = { title: 'Recursos — appestetika' };

async function loadResources(showArchived: boolean) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return [];

  let query = supabase
    .from('resources')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (!showArchived) query = query.eq('active', true);

  const { data } = await query;
  return data ?? [];
}

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; archived?: string };
}) {
  await requireMembership({ minRole: 'admin' });
  const showArchived = searchParams.archived === '1';
  const resources = await loadResources(showArchived);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Recursos</h1>
          <p className="mt-1 text-sm text-stone-500">
            Cabinas, máquinas y otros recursos que se usan en los turnos.
          </p>
        </div>
        <ResourcesClient mode="create" />
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Recurso {searchParams.ok}.
        </div>
      )}

      <div className="flex items-center gap-2">
        <a
          href="/recursos"
          className={`inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm ${!showArchived ? 'bg-brand-100 text-brand-800' : 'text-stone-600'}`}
        >
          Activos
        </a>
        <a
          href="/recursos?archived=1"
          className={`inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm ${showArchived ? 'bg-brand-100 text-brand-800' : 'text-stone-600'}`}
        >
          Todos
        </a>
      </div>

      {/* Mobile: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {resources.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-center text-sm text-stone-400">
            No hay recursos cargados.
          </div>
        )}
        {resources.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
          >
            <div className="font-medium text-stone-900">{r.name}</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-stone-600">{r.type}</span>
              {r.active ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="secondary">Archivado</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <ResourcesClient mode="edit" resource={r} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden rounded-xl border border-stone-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-40 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-stone-400">
                  No hay recursos cargados.
                </TableCell>
              </TableRow>
            )}
            {resources.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-stone-600">{r.type}</TableCell>
                <TableCell>
                  {r.active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Archivado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ResourcesClient mode="edit" resource={r} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
