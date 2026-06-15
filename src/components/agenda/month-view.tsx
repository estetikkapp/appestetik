import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APPOINTMENT_STATUS_LABELS } from '@/types/app';
import type { AppointmentStatus } from '@/types/app';
import type { AppointmentWithRelations } from './day-view';

interface MonthViewProps {
  /** Primer día del mes en formato YYYY-MM-DD */
  monthStart: string;
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

const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftMonth(monthStartStr: string, delta: number): string {
  const [y, m] = monthStartStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1, 12, 0, 0));
  return fmtDate(dt);
}

function getLocalDateAr(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function MonthView({ monthStart, appointments }: MonthViewProps) {
  const firstOfMonth = parseLocalDate(monthStart);
  const year = firstOfMonth.getUTCFullYear();
  const month = firstOfMonth.getUTCMonth();

  // Día de la semana del 1: 0=dom, 1=lun, ... 6=sáb. Quiero lun=0, dom=6.
  const firstDow = firstOfMonth.getUTCDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;

  // Días del mes
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // Construir grid de 6 filas x 7 columnas (algunos meses requieren 6)
  const cells: Array<{ date: Date | null; dateStr: string }> = [];
  for (let i = 0; i < offset; i++) cells.push({ date: null, dateStr: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month, d, 12, 0, 0));
    cells.push({ date: dt, dateStr: fmtDate(dt) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, dateStr: '' });

  // Bucket appointments
  const byDay = new Map<string, AppointmentWithRelations[]>();
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

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());

  const monthName = firstOfMonth.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = shiftMonth(monthStart, -1);
  const nextMonth = shiftMonth(monthStart, 1);
  const todayMonth = (() => {
    const t = new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
    }).format(t).replace(/(\d{4})-(\d{2})/, '$1-$2-01');
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agenda?view=month&date=${prevMonth}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 sm:min-w-[220px]">
            <Calendar className="h-4 w-4 shrink-0 text-stone-500" />
            <span className="truncate text-xs font-medium capitalize sm:text-sm">{monthName}</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agenda?view=month&date=${nextMonth}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/agenda?view=month&date=${todayMonth}`}>Este mes</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-2">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell.date) {
              return <div key={idx} className="min-h-[56px] sm:min-h-[80px]" />;
            }
            const items = byDay.get(cell.dateStr) ?? [];
            const isToday = cell.dateStr === todayStr;
            return (
              <Link
                key={idx}
                href={`/agenda?date=${cell.dateStr}`}
                className={`flex min-h-[56px] flex-col rounded-lg border p-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:min-h-[80px] ${
                  isToday ? 'border-brand-300 bg-brand-50/40' : 'border-stone-100 bg-white'
                }`}
              >
                <div
                  className={`text-xs font-medium tabular-nums ${
                    isToday ? 'text-brand-700' : 'text-stone-700'
                  }`}
                >
                  {cell.date.getUTCDate()}
                </div>

                {/* Mobile: resumen compacto con puntos de estado + contador */}
                <div className="mt-1 flex flex-wrap items-center gap-1 overflow-hidden sm:hidden">
                  {items.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                      title={`${formatTime(a.starts_at)} ${a.client?.full_name ?? ''} - ${APPOINTMENT_STATUS_LABELS[a.status]}`}
                    />
                  ))}
                  {items.length > 3 && (
                    <span className="text-[10px] leading-none text-stone-500">
                      +{items.length - 3}
                    </span>
                  )}
                </div>

                {/* Desktop: chips con horario + nombre */}
                <div className="mt-1 hidden flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                  {items.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1 truncate rounded bg-stone-50 px-1 py-0.5 text-[10px]"
                      title={`${formatTime(a.starts_at)} ${a.client?.full_name ?? ''} - ${APPOINTMENT_STATUS_LABELS[a.status]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                      />
                      <span className="truncate text-stone-700">
                        {formatTime(a.starts_at)} {a.client?.full_name ?? ''}
                      </span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-stone-500">+{items.length - 3} más</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
  });
}
