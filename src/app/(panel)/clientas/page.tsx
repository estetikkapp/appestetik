import Link from 'next/link';
import { cookies } from 'next/headers';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
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

async function loadClients(search: string, filter: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return [];

  let query = supabase
    .from('clients')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (search && search.length >= 2) {
    // Escapar caracteres especiales de PostgREST or() — sin esto un nombre
    // con coma o paréntesis rompe la query.
    const safe = search.replace(/[,()"]/g, '');
    if (safe.trim()) {
      query = query.or(
        `full_name.ilike.%${safe}%,phone_e164.ilike.%${safe}%,dni.ilike.%${safe}%`
      );
    }
  }

  if (filter === 'dormant') {
    // Sin visita en últimos 90 días (incluye nunca visitada)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`last_visit_at.is.null,last_visit_at.lt.${ninetyDaysAgo}`);
  } else if (filter === 'birthday') {
    // Cumpleaños este mes (filtramos client-side abajo porque Postgres
    // no tiene una forma trivial via PostgREST de comparar solo el mes)
    // Devolvemos todas y filtramos abajo
  } else if (filter === 'with_email') {
    query = query.not('email', 'is', null);
  } else if (filter === 'no_phone') {
    query = query.is('phone_e164', null);
  }

  const { data } = await query;
  let result = data ?? [];

  if (filter === 'birthday') {
    const currentMonth = new Date().getUTCMonth() + 1;
    result = result.filter((c) => {
      if (!c.birthdate) return false;
      const m = parseInt(c.birthdate.slice(5, 7), 10);
      return m === currentMonth;
    });
  }

  return result;
}

export default async function ClientasPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; q?: string; n?: string; skipped?: string; filter?: string };
}) {
  const search = searchParams.q ?? '';
  const filter = searchParams.filter ?? 'all';
  const clients = await loadClients(search, filter);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Clientas</h1>
          <p className="mt-1 text-sm text-stone-500">
            Base de datos de clientas con historial y datos de contacto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/clientas/importar">
              <Upload className="mr-1 h-3 w-3" />
              Importar CSV
            </Link>
          </Button>
          <ClientsPageClient mode="create" />
        </div>
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok === 'importadas'
            ? `Importadas ${searchParams.n ?? 0} clientas${searchParams.skipped ? ` · ${searchParams.skipped} saltadas por errores o duplicadas` : ''}.`
            : `Clienta ${searchParams.ok}.`}
        </div>
      )}

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre, teléfono o DNI..."
          className="flex h-10 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-4 text-sm text-white hover:bg-brand-600"
        >
          Buscar
        </button>
        {(search || filter !== 'all') && (
          <a href="/clientas" className="rounded-lg px-3 text-sm text-stone-500 hover:bg-stone-100">
            Limpiar
          </a>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'all', label: 'Todas' },
            { key: 'dormant', label: 'Inactivas (90+ días)' },
            { key: 'birthday', label: 'Cumpleaños del mes' },
            { key: 'with_email', label: 'Con email' },
            { key: 'no_phone', label: 'Sin teléfono' },
          ] as const
        ).map((f) => {
          const params = new URLSearchParams();
          if (f.key !== 'all') params.set('filter', f.key);
          if (search) params.set('q', search);
          const href = `/clientas${params.toString() ? `?${params.toString()}` : ''}`;
          const isActive = filter === f.key;
          return (
            <a
              key={f.key}
              href={href}
              className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-100 text-brand-800 font-medium'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {f.label}
            </a>
          );
        })}
        <span className="ml-auto text-xs text-stone-400">{clients.length} resultados</span>
      </div>

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
                  <a href={`/clientas/${c.id}`} className="font-medium text-stone-900 hover:text-brand-700 hover:underline">
                    {c.full_name}
                  </a>
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
