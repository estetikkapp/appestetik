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
import { PackagesPageClient } from './packages-client';

export const metadata = { title: 'Paquetes — appestetika' };

async function loadPackages(showArchived: boolean) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return { packages: [], services: [] };

  let pkgQuery = supabase
    .from('packages')
    .select('*, service:services(id, name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (!showArchived) pkgQuery = pkgQuery.eq('active', true);

  const [pkgResult, servicesResult] = await Promise.all([
    pkgQuery,
    supabase
      .from('services')
      .select('id, name, price_ars')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
  ]);

  return { packages: pkgResult.data ?? [], services: servicesResult.data ?? [] };
}

export default async function PaquetesPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; archived?: string };
}) {
  await requireMembership({ minRole: 'admin' });
  // Paquetes ESTÁN incluidos en Gabinete según definitions.ts — sin gate
  // de plan. Solo rol admin/owner. (Antes había gate por error.)
  const showArchived = searchParams.archived === '1';
  const { packages, services } = await loadPackages(showArchived);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Paquetes y bonos</h1>
          <p className="mt-1 text-sm text-stone-500">
            Vendé sesiones prepagas con descuento. Ej: &quot;10 sesiones láser axilas&quot;.
          </p>
        </div>
        <PackagesPageClient mode="create" services={services} />
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Paquete {searchParams.ok}.
        </div>
      )}

      <div className="flex items-center gap-2">
        <a
          href="/paquetes"
          className={`inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm ${!showArchived ? 'bg-brand-100 text-brand-800' : 'text-stone-600'}`}
        >
          Activos
        </a>
        <a
          href="/paquetes?archived=1"
          className={`inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm ${showArchived ? 'bg-brand-100 text-brand-800' : 'text-stone-600'}`}
        >
          Todos
        </a>
      </div>

      {/* Mobile: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {packages.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-center text-sm text-stone-400">
            No hay paquetes cargados todavía.
          </div>
        )}
        {packages.map((p) => {
          const svc = Array.isArray(p.service) ? p.service[0] : p.service;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
            >
              <div>
                <div className="font-medium text-stone-900">{p.name}</div>
                {p.description && (
                  <div className="text-xs text-stone-500">{p.description}</div>
                )}
              </div>
              <div className="text-sm text-stone-600">
                <span className="text-stone-400">Servicio: </span>
                {svc?.name ?? '—'}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-stone-400">Sesiones</span>
                  <div className="font-medium text-stone-900">{p.sessions_total}</div>
                </div>
                <div>
                  <span className="text-stone-400">Validez</span>
                  <div className="font-medium text-stone-900">{p.validity_days}d</div>
                </div>
                <div>
                  <span className="text-stone-400">Precio</span>
                  <div className="font-medium text-stone-900">
                    {formatArs(Number(p.price_ars))}
                  </div>
                </div>
                <div>
                  <span className="text-stone-400">Descuento</span>
                  <div className="font-medium text-stone-900">
                    {p.discount_percentage && Number(p.discount_percentage) > 0 ? (
                      <Badge variant="premium">{p.discount_percentage}%</Badge>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <PackagesPageClient mode="edit" pkg={p as any} services={services} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden rounded-xl border border-stone-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead className="text-right">Sesiones</TableHead>
              <TableHead className="text-right">Validez</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Descuento</TableHead>
              <TableHead className="w-44 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-stone-400">
                  No hay paquetes cargados todavía.
                </TableCell>
              </TableRow>
            )}
            {packages.map((p) => {
              const svc = Array.isArray(p.service) ? p.service[0] : p.service;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-stone-500">{p.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{svc?.name ?? '—'}</TableCell>
                  <TableCell className="text-right">{p.sessions_total}</TableCell>
                  <TableCell className="text-right">{p.validity_days}d</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatArs(Number(p.price_ars))}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.discount_percentage && Number(p.discount_percentage) > 0 ? (
                      <Badge variant="premium">{p.discount_percentage}%</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <PackagesPageClient mode="edit" pkg={p as any} services={services} />
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
