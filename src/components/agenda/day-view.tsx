import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatArs } from '@/lib/utils/format-ars';
import { APPOINTMENT_STATUS_LABELS } from '@/types/app';
import type { AppointmentStatus } from '@/types/app';
import { AppointmentRowActions } from './appointment-actions';
import { PrintButton } from './print-button';

export interface AppointmentWithRelations {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  reminder_sent_at?: string | null;
  client: { id: string; full_name: string; phone_e164: string | null } | null;
  service: { id: string; name: string; duration_minutes: number; price_ars: number } | null;
  professional_name: string | null;
  resource_name: string | null;
}

interface DayViewProps {
  date: string; // YYYY-MM-DD
  appointments: AppointmentWithRelations[];
  businessHours: { opens_at: string | null; closes_at: string | null; active: boolean } | null;
}

const STATUS_VARIANT: Record<AppointmentStatus, 'default' | 'success' | 'secondary' | 'destructive' | 'premium' | 'outline'> = {
  pending: 'outline',
  confirmed: 'default',
  in_progress: 'premium',
  completed: 'success',
  cancelled: 'secondary',
  no_show: 'destructive',
};

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function generateTimeSlots(opensAt: string, closesAt: string, stepMinutes = 30): string[] {
  const [oH, oM] = opensAt.split(':').map(Number);
  const [cH, cM] = closesAt.split(':').map(Number);
  const start = (oH ?? 9) * 60 + (oM ?? 0);
  const end = (cH ?? 19) * 60 + (cM ?? 0);

  const slots: string[] = [];
  for (let t = start; t < end; t += stepMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

function isoToLocalTimeStr(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function DayView({ date, appointments, businessHours }: DayViewProps) {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0));
  const prevDate = new Date(dateObj);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(dateObj);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const humanDate = dateObj.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const closed = !businessHours?.active;
  const opens = businessHours?.opens_at ?? '09:00';
  const closes = businessHours?.closes_at ?? '19:00';
  const slots = closed ? [] : generateTimeSlots(opens.slice(0, 5), closes.slice(0, 5));

  // Map de slot → appointments que caen en ese slot
  const slotMap = new Map<string, AppointmentWithRelations[]>();
  slots.forEach((s) => slotMap.set(s, []));

  for (const appt of appointments) {
    const startSlot = isoToLocalTimeStr(appt.starts_at);
    // Si el slot existe, agregar; si no (antes de apertura), crear uno
    if (!slotMap.has(startSlot)) slotMap.set(startSlot, []);
    slotMap.get(startSlot)!.push(appt);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 print:block">
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agenda?date=${fmtDate(prevDate)}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5">
            <CalendarDays className="h-4 w-4 text-stone-500" />
            <span className="text-sm font-medium capitalize">{humanDate}</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/agenda?date=${fmtDate(nextDate)}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/agenda?date=${fmtDate(new Date())}`}>Hoy</Link>
          </Button>
        </div>
        <PrintButton />
        <h2 className="hidden text-xl font-bold capitalize text-stone-900 print:block">
          {humanDate}
        </h2>
      </div>

      {closed && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center text-sm text-stone-500">
          Centro cerrado este día.
        </div>
      )}

      {!closed && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="divide-y divide-stone-100">
            {Array.from(slotMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([slot, items]) => (
                <div key={slot} className="flex gap-4 px-4 py-2">
                  <div className="w-16 shrink-0 pt-2 text-xs font-medium text-stone-500 tabular-nums">
                    {slot}
                  </div>
                  <div className="flex-1 space-y-2">
                    {items.length === 0 ? (
                      <div className="h-12 rounded-lg border border-dashed border-stone-200 opacity-40" />
                    ) : (
                      items.map((appt) => (
                        <div
                          id={`appt-${appt.id}`}
                          key={appt.id}
                          className="group flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50/50 p-3 print:break-inside-avoid"
                        >
                          <div className="flex flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-stone-900">
                                {appt.client?.full_name ?? 'Sin clienta'}
                              </span>
                              <Badge variant={STATUS_VARIANT[appt.status]} className="print:hidden">
                                {APPOINTMENT_STATUS_LABELS[appt.status]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-600">
                              <span>{appt.service?.name ?? '—'}</span>
                              <span>·</span>
                              <span>
                                {formatTime(appt.starts_at)}–{formatTime(appt.ends_at)}
                              </span>
                              {appt.professional_name && (
                                <>
                                  <span>·</span>
                                  <span>{appt.professional_name}</span>
                                </>
                              )}
                              {appt.resource_name && (
                                <>
                                  <span>·</span>
                                  <span>{appt.resource_name}</span>
                                </>
                              )}
                              {appt.service?.price_ars !== undefined && (
                                <>
                                  <span>·</span>
                                  <span className="font-medium text-stone-700">
                                    {formatArs(Number(appt.service.price_ars))}
                                  </span>
                                </>
                              )}
                            </div>
                            {appt.notes && (
                              <p className="text-xs text-stone-500">{appt.notes}</p>
                            )}
                          </div>
                          <div className="print:hidden">
                            <AppointmentRowActions
                              id={appt.id}
                              status={appt.status}
                              startsAt={appt.starts_at}
                              clientName={appt.client?.full_name ?? undefined}
                              hasPhone={!!appt.client?.phone_e164}
                              reminderSentAt={appt.reminder_sent_at ?? null}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
