import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPhoneDisplay } from '@/lib/utils/format-phone';
import { formatDateAr } from '@/lib/utils/dates';
import { ClientsPageClient } from './clients-client';

export const metadata = { title: 'Clientas — appestetika' };

async function loadClients(search: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return [];

  let query = supabase
    .from('clients')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (search && search.length >= 2) {
    query = query.or(
      `full_name.ilike.%${search}%,phone_e164.ilike.%${search}%,dni.ilike.%${search}%`
    );
  }

  const { data } = await query;
  return data ?? [];
}

export default async function ClientasPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; q?: string };
}) {
  const search = searchParams.q ?? '';
  const clients = await loadClients(search);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Clientas</h1>
          <p className="mt-1 text-sm text-stone-500">
            Base de datos de clientas con historial y datos de contacto.
          </p>
        </div>
        <ClientsPageClient mode="create" />
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Clienta {searchParams.ok}.
        </div>
      )}

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre, teléfono o DNI..."
          className="flex h-10 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-4 text-sm text-white hover:bg-brand-600"
        >
          Buscar
        </button>
        {search && (
          <a href="/clientas" className="rounded-lg px-3 text-sm text-stone-500 hover:bg-stone-100">
            Limpiar
          </a>
        )}
      </form>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Última visita</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-stone-400">
                  {search
                    ? 'No hay clientas que coincidan con la búsqueda.'
                    : 'No hay clientas cargadas todavía.'}
                </TableCell>
              </TableRow>
            )}
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.full_name}</div>
                  {c.email && <div className="text-xs text-stone-500">{c.email}</div>}
                </TableCell>
                <TableCell className="text-sm text-stone-600">
                  {c.phone_e164 ? formatPhoneDisplay(c.phone_e164) : '—'}
                </TableCell>
                <TableCell className="text-sm text-stone-600">{c.dni ?? '—'}</TableCell>
                <TableCell className="text-sm text-stone-600">
                  {c.last_visit_at ? formatDateAr(c.last_visit_at) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <ClientsPageClient mode="edit" client={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
