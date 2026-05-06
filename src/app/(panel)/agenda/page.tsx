import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DayView, type AppointmentWithRelations } from '@/components/agenda/day-view';
import { WeekView } from '@/components/agenda/week-view';
import { MonthView } from '@/components/agenda/month-view';
import { CreateAppointmentSheet } from '@/components/agenda/create-appointment-sheet';
import { formatArs } from '@/lib/utils/format-ars';

export const metadata = { title: 'Agenda — appestetika' };

function todayInAr(): string {
  const now = new Date();
  const arFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return arFormat.format(now);
}

function dayOfWeekAr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  return dt.getUTCDay();
}

/** Lunes de la semana de la fecha (YYYY-MM-DD). */
function getMondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

/** Primer día del mes de la fecha (YYYY-MM-DD). */
function getMonthStartOf(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, 1, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function shiftIsoDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function loadDayAgenda(date: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const dayStartAr = `${date}T00:00:00-03:00`;
  const dayEndAr = `${date}T23:59:59-03:00`;

  const [
    apptsResult,
    servicesResult,
    clientsResult,
    professionalsResult,
    resourcesResult,
    businessHoursResult,
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        `id, starts_at, ends_at, status, notes, professional_id, resource_id,
         client:clients!client_id(id, full_name, phone_e164),
         service:services!service_id(id, name, duration_minutes, price_ars)`
      )
      .eq('organization_id', orgId)
      .gte('starts_at', dayStartAr)
      .lte('starts_at', dayEndAr)
      .order('starts_at'),
    supabase
      .from('services')
      .select('id, name, duration_minutes, price_ars')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('clients')
      .select('id, full_name, phone_e164')
      .eq('organization_id', orgId)
      .order('full_name')
      .limit(500),
    supabase
      .from('memberships')
      .select('user_id, display_name, role')
      .eq('organization_id', orgId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'professional']),
    supabase
      .from('resources')
      .select('id, name, type')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('business_hours')
      .select('opens_at, closes_at, active')
      .eq('organization_id', orgId)
      .eq('day_of_week', dayOfWeekAr(date))
      .maybeSingle(),
  ]);

  const professionalsById = new Map(
    (professionalsResult.data ?? []).map((p) => [p.user_id, p.display_name ?? 'Sin nombre'])
  );
  const resourcesById = new Map((resourcesResult.data ?? []).map((r) => [r.id, r.name]));

  const appointments: AppointmentWithRelations[] = (apptsResult.data ?? []).map((a) => {
    const clientRel = Array.isArray(a.client) ? a.client[0] : a.client;
    const serviceRel = Array.isArray(a.service) ? a.service[0] : a.service;
    return {
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      notes: a.notes,
      client: clientRel
        ? { id: clientRel.id, full_name: clientRel.full_name, phone_e164: clientRel.phone_e164 }
        : null,
      service: serviceRel
        ? {
            id: serviceRel.id,
            name: serviceRel.name,
            duration_minutes: serviceRel.duration_minutes,
            price_ars: Number(serviceRel.price_ars),
          }
        : null,
      professional_name: a.professional_id
        ? professionalsById.get(a.professional_id) ?? null
        : null,
      resource_name: a.resource_id ? resourcesById.get(a.resource_id) ?? null : null,
    };
  });

  return {
    appointments,
    services: (servicesResult.data ?? []).map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: `${s.duration_minutes}min · ${formatArs(Number(s.price_ars))}`,
    })),
    clients: (clientsResult.data ?? []).map((c) => ({
      id: c.id,
      label: c.full_name,
      sublabel: c.phone_e164 ?? undefined,
    })),
    professionals: (professionalsResult.data ?? [])
      .filter((p) => p.user_id)
      .map((p) => ({
        id: p.user_id,
        label: p.display_name ?? 'Sin nombre',
        sublabel: p.role,
      })),
    resources: (resourcesResult.data ?? []).map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: r.type,
    })),
    businessHours: businessHoursResult.data ?? null,
  };
}

async function loadMonthAgenda(monthStart: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [y, m] = monthStart.split('-').map(Number);
  const nextMonthFirst = new Date(Date.UTC(y ?? 0, (m ?? 1), 1, 12, 0, 0));
  const startIso = `${monthStart}T00:00:00-03:00`;
  const endIso = `${nextMonthFirst.toISOString().slice(0, 10)}T00:00:00-03:00`;

  const [apptsResult, servicesResult, clientsResult, professionalsResult, resourcesResult] =
    await Promise.all([
      supabase
        .from('appointments')
        .select(
          `id, starts_at, ends_at, status, notes, professional_id, resource_id,
           client:clients!client_id(id, full_name, phone_e164),
           service:services!service_id(id, name, duration_minutes, price_ars)`
        )
        .eq('organization_id', orgId)
        .gte('starts_at', startIso)
        .lt('starts_at', endIso)
        .order('starts_at'),
      supabase
        .from('services')
        .select('id, name, duration_minutes, price_ars')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('name'),
      supabase
        .from('clients')
        .select('id, full_name, phone_e164')
        .eq('organization_id', orgId)
        .order('full_name')
        .limit(500),
      supabase
        .from('memberships')
        .select('user_id, display_name, role')
        .eq('organization_id', orgId)
        .eq('active', true)
        .in('role', ['owner', 'admin', 'professional']),
      supabase
        .from('resources')
        .select('id, name, type')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('name'),
    ]);

  const professionalsById = new Map(
    (professionalsResult.data ?? []).map((p) => [p.user_id, p.display_name ?? 'Sin nombre'])
  );
  const resourcesById = new Map((resourcesResult.data ?? []).map((r) => [r.id, r.name]));

  const appointments: AppointmentWithRelations[] = (apptsResult.data ?? []).map((a) => {
    const clientRel = Array.isArray(a.client) ? a.client[0] : a.client;
    const serviceRel = Array.isArray(a.service) ? a.service[0] : a.service;
    return {
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      notes: a.notes,
      client: clientRel
        ? { id: clientRel.id, full_name: clientRel.full_name, phone_e164: clientRel.phone_e164 }
        : null,
      service: serviceRel
        ? {
            id: serviceRel.id,
            name: serviceRel.name,
            duration_minutes: serviceRel.duration_minutes,
            price_ars: Number(serviceRel.price_ars),
          }
        : null,
      professional_name: a.professional_id
        ? professionalsById.get(a.professional_id) ?? null
        : null,
      resource_name: a.resource_id ? resourcesById.get(a.resource_id) ?? null : null,
    };
  });

  return {
    appointments,
    services: (servicesResult.data ?? []).map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: `${s.duration_minutes}min · ${formatArs(Number(s.price_ars))}`,
    })),
    clients: (clientsResult.data ?? []).map((c) => ({
      id: c.id,
      label: c.full_name,
      sublabel: c.phone_e164 ?? undefined,
    })),
    professionals: (professionalsResult.data ?? [])
      .filter((p) => p.user_id)
      .map((p) => ({
        id: p.user_id,
        label: p.display_name ?? 'Sin nombre',
        sublabel: p.role,
      })),
    resources: (resourcesResult.data ?? []).map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: r.type,
    })),
  };
}

async function loadWeekAgenda(weekStart: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const weekEnd = shiftIsoDate(weekStart, 7);
  const startIso = `${weekStart}T00:00:00-03:00`;
  const endIso = `${weekEnd}T00:00:00-03:00`;

  const [apptsResult, servicesResult, clientsResult, professionalsResult, resourcesResult] =
    await Promise.all([
      supabase
        .from('appointments')
        .select(
          `id, starts_at, ends_at, status, notes, professional_id, resource_id,
           client:clients!client_id(id, full_name, phone_e164),
           service:services!service_id(id, name, duration_minutes, price_ars)`
        )
        .eq('organization_id', orgId)
        .gte('starts_at', startIso)
        .lt('starts_at', endIso)
        .order('starts_at'),
      supabase
        .from('services')
        .select('id, name, duration_minutes, price_ars')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('name'),
      supabase
        .from('clients')
        .select('id, full_name, phone_e164')
        .eq('organization_id', orgId)
        .order('full_name')
        .limit(500),
      supabase
        .from('memberships')
        .select('user_id, display_name, role')
        .eq('organization_id', orgId)
        .eq('active', true)
        .in('role', ['owner', 'admin', 'professional']),
      supabase
        .from('resources')
        .select('id, name, type')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('name'),
    ]);

  const professionalsById = new Map(
    (professionalsResult.data ?? []).map((p) => [p.user_id, p.display_name ?? 'Sin nombre'])
  );
  const resourcesById = new Map((resourcesResult.data ?? []).map((r) => [r.id, r.name]));

  const appointments: AppointmentWithRelations[] = (apptsResult.data ?? []).map((a) => {
    const clientRel = Array.isArray(a.client) ? a.client[0] : a.client;
    const serviceRel = Array.isArray(a.service) ? a.service[0] : a.service;
    return {
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      notes: a.notes,
      client: clientRel
        ? { id: clientRel.id, full_name: clientRel.full_name, phone_e164: clientRel.phone_e164 }
        : null,
      service: serviceRel
        ? {
            id: serviceRel.id,
            name: serviceRel.name,
            duration_minutes: serviceRel.duration_minutes,
            price_ars: Number(serviceRel.price_ars),
          }
        : null,
      professional_name: a.professional_id
        ? professionalsById.get(a.professional_id) ?? null
        : null,
      resource_name: a.resource_id ? resourcesById.get(a.resource_id) ?? null : null,
    };
  });

  return {
    appointments,
    services: (servicesResult.data ?? []).map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: `${s.duration_minutes}min · ${formatArs(Number(s.price_ars))}`,
    })),
    clients: (clientsResult.data ?? []).map((c) => ({
      id: c.id,
      label: c.full_name,
      sublabel: c.phone_e164 ?? undefined,
    })),
    professionals: (professionalsResult.data ?? [])
      .filter((p) => p.user_id)
      .map((p) => ({
        id: p.user_id,
        label: p.display_name ?? 'Sin nombre',
        sublabel: p.role,
      })),
    resources: (resourcesResult.data ?? []).map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: r.type,
    })),
  };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { date?: string; error?: string; ok?: string; view?: string };
}) {
  const view: 'day' | 'week' | 'month' =
    searchParams.view === 'week' ? 'week' : searchParams.view === 'month' ? 'month' : 'day';
  const date = searchParams.date ?? todayInAr();
  const weekStart = view === 'week' ? getMondayOf(date) : date;
  const monthStart = view === 'month' ? getMonthStartOf(date) : date;

  const data =
    view === 'week'
      ? await loadWeekAgenda(weekStart)
      : view === 'month'
      ? await loadMonthAgenda(monthStart)
      : await loadDayAgenda(date);

  if (!data) {
    return <div className="text-sm text-stone-500">No hay organización activa.</div>;
  }

  // Default date for "create appointment" sheet: el día pedido (o hoy si vista no-day)
  const defaultDateForSheet = view === 'day' ? date : todayInAr();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:block">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Agenda</h1>
          <p className="mt-1 text-sm text-stone-500 print:hidden">
            {view === 'day'
              ? 'Turnos del día con vista hora a hora.'
              : view === 'week'
              ? 'Vista semanal compacta.'
              : 'Vista mensual.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
            <Link
              href={`/agenda?date=${date}`}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'day' ? 'bg-brand-100 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              Día
            </Link>
            <Link
              href={`/agenda?view=week&date=${getMondayOf(date)}`}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'week' ? 'bg-brand-100 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              Semana
            </Link>
            <Link
              href={`/agenda?view=month&date=${getMonthStartOf(date)}`}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                view === 'month' ? 'bg-brand-100 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              Mes
            </Link>
          </div>
          <CreateAppointmentSheet
            services={data.services}
            clients={data.clients}
            professionals={data.professionals}
            resources={data.resources}
            defaultDate={defaultDateForSheet}
          />
        </div>
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok === 'creado' && 'Turno creado.'}
          {searchParams.ok === 'bloqueo-creado' && 'Bloqueo agregado.'}
          {searchParams.ok === 'reagendado' && 'Turno reagendado.'}
        </div>
      )}

      {view === 'day' ? (
        <DayView
          date={date}
          appointments={data.appointments}
          businessHours={
            'businessHours' in data
              ? (data.businessHours as { opens_at: string | null; closes_at: string | null; active: boolean } | null)
              : null
          }
        />
      ) : view === 'week' ? (
        <WeekView weekStart={weekStart} appointments={data.appointments} />
      ) : (
        <MonthView monthStart={monthStart} appointments={data.appointments} />
      )}
    </div>
  );
}
