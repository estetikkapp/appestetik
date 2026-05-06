import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { APPOINTMENT_STATUS_LABELS } from '@/types/app';
import type { AppointmentStatus } from '@/types/app';
import type { AppointmentWithRelations } from './day-view';

interface WeekViewProps {
  /** Lunes de la semana (YYYY-MM-DD) */
  weekStart: string;
  appointments: AppointmentWithRelations[];
}

const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending: 'bg-stone-300',
  confirmed: 'bg-brand-500',
  in_progress: 'bg-gold-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-stone-200',
  no_show: 'bg-red-500',
};

const STATUS_VARIANT: Record<AppointmentStatus, 'default' | 'success' | 'secondary' | 'destructive' | 'premium' | 'outline'> = {
  pending: 'outline',
  confirmed: 'default',
  in_progress: 'premium',
  completed: 'success',
  cancelled: 'secondary',
  no_show: 'destructive',
};

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLocalDateAr(iso: string): string {
  const d = new Date(iso);
  // Get YYYY-MM-DD in AR timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function WeekView({ weekStart, appointments }: WeekViewProps) {
  const monday = parseLocalDate(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(monday, i));

  // Bucket appointments by date string
  const byDay = new Map<string, AppointmentWithRelations[]>();
  for (const d of days) byDay.set(fmtDate(d), []);
  for (const a of appointments) {
    const key = getLocalDateAr(a.starts_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(a);
  }
  for (const list of Array.from(byDay.values())) {
    list.sort(
      (a: AppointmentWithRelations, b: AppointmentWithRelations) =>
        a.starts_at.localeCompare(b.starts_at)
    );
  }

  const prevWeek = fmtDate(shiftDays(monday, -7));
  const nextWeek = fmtDate(shiftDays(monday, 7));
  const todayStr = (() => {
    const t = new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(t);
  })();

  // Mostrar rango de la semana en formato humano
  const startTxt = monday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const sundayTxt = days[6]!.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agenda?view=week&date=${prevWeek}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5">
            <CalendarRange className="h-4 w-4 text-stone-500" />
            <span className="text-sm font-medium capitalize">
              Semana del {startTxt} al {sundayTxt}
            </span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agenda?view=week&date=${nextWeek}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/agenda?view=week&date=${getMondayOf(todayStr)}`}>Esta semana</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((d, idx) => {
          const dateStr = fmtDate(d);
          const items = byDay.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const dayLabel = DAY_LABELS[idx];
          return (
            <div
              key={dateStr}
              className={`rounded-xl border ${
                isToday ? 'border-brand-300 bg-brand-50/30' : 'border-stone-200 bg-white'
              }`}
            >
              <Link
                href={`/agenda?date=${dateStr}`}
                className="flex items-center justify-between border-b border-stone-100 px-3 py-2 transition-colors hover:bg-stone-50"
              >
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    {dayLabel}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-brand-700' : 'text-stone-900'}`}>
                    {d.getUTCDate()}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {items.length}
                </Badge>
              </Link>

              <div className="space-y-1 p-2">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-xs text-stone-300">Sin turnos</p>
                ) : (
                  items.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agenda?date=${dateStr}#appt-${a.id}`}
                      className={`block rounded-lg border border-stone-100 p-2 transition-colors hover:border-brand-300 hover:bg-brand-50/40 ${
                        a.status === 'cancelled' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                          title={APPOINTMENT_STATUS_LABELS[a.status]}
                        />
                        <span className="text-xs font-medium tabular-nums text-stone-700">
                          {formatTime(a.starts_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs font-medium text-stone-900">
                        {a.client?.full_name ?? 'Sin clienta'}
                      </div>
                      <div className="truncate text-[10px] text-stone-500">
                        {a.service?.name ?? '—'}
                        {a.professional_name && ` · ${a.professional_name}`}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  const items: Array<{ status: AppointmentStatus; label: string }> = [
    { status: 'pending', label: 'Pendiente' },
    { status: 'confirmed', label: 'Confirmado' },
    { status: 'in_progress', label: 'En curso' },
    { status: 'completed', label: 'Completado' },
    { status: 'no_show', label: 'No vino' },
    { status: 'cancelled', label: 'Cancelado' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
      {items.map((i) => (
        <span key={i.status} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[i.status]}`} />
          <span>{i.label}</span>
          <Badge variant={STATUS_VARIANT[i.status]} className="hidden">
            {/* keep badge variant referenced to avoid unused-import warning */}
          </Badge>
        </span>
      ))}
    </div>
  );
}

/** Devuelve el lunes de la semana en la que cae la fecha dada (YYYY-MM-DD). */
function getMondayOf(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const dow = d.getUTCDay(); // 0 = sun, 1 = mon, ... 6 = sat
  // En AR queremos lunes como inicio: si dow=0 (domingo), restar 6; si dow=1, restar 0; etc.
  const diff = dow === 0 ? -6 : 1 - dow;
  return fmtDate(shiftDays(d, diff));
}
