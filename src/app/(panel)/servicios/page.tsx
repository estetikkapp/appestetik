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
import { formatArs } from '@/lib/utils/format-ars';
import { ServicesPageClient } from './services-client';
import { SetupStatusBanner } from '@/components/setup-status-banner';

export const metadata = { title: 'Servicios — appestetika' };

async function loadServices(showArchived: boolean) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return [];

  let query = supabase
    .from('services')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (!showArchived) query = query.eq('active', true);

  const { data } = await query;
  return data ?? [];
}

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; archived?: string };
}) {
  await requireMembership({ minRole: 'admin' });
  const showArchived = searchParams.archived === '1';
  const services = await loadServices(showArchived);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Servicios</h1>
          <p className="mt-1 text-sm text-stone-500">
            Catálogo de servicios que ofrece tu centro.
          </p>
        </div>
        <ServicesPageClient mode="create" />
      </div>

      <SetupStatusBanner />

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Servicio {searchParams.ok}.
        </div>
      )}

      <div className="flex items-center gap-2">
        <a
          href="/servicios"
          className={`rounded-lg px-3 py-1 text-sm ${!showArchived ? 'bg-brand-100 text-brand-800' : 'text-stone-600'}`}
        >
          Activos
        </a>
        <a
          href="/servicios?archived=1"
          className={`rounded-lg px-3 py-1 text-sm ${showArchived ? 'bg-brand-100 text-brand-800' : 'text-stone-600'}`}
        >
          Todos (incluye archivados)
        </a>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-40 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-stone-400">
                  No hay servicios {showArchived ? '' : 'activos'}. Creá el primero con el botón
                  arriba.
                </TableCell>
              </TableRow>
            )}
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  {s.requires_consent && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      Requiere consentimiento
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-stone-600">{s.category ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.duration_minutes} min
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatArs(Number(s.price_ars))}
                </TableCell>
                <TableCell>
                  {s.active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="secondary">Archivado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ServicesPageClient mode="edit" service={s} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
