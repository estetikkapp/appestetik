'use client';

import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { rescheduleAppointment } from '@/actions/appointments';

interface Props {
  id: string;
  /** ISO actual de starts_at (para precargar el datetime-local) */
  currentStartsAt: string;
  /** Nombre de la clienta (UI) */
  clientName: string;
  /** Si tiene phone, mostramos opción de notificar */
  hasPhone: boolean;
}

/**
 * Convierte un ISO UTC al string `YYYY-MM-DDTHH:MM` en TZ AR — formato
 * que `<input type="datetime-local">` espera.
 */
function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  // Build YYYY-MM-DD HH:MM en AR
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${y}-${m}-${day}T${hour === '24' ? '00' : hour}:${min}`;
}

export function RescheduleButton({ id, currentStartsAt, clientName, hasPhone }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Reagendar"
          aria-label={`Reagendar turno de ${clientName}`}
          className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reagendar turno</DialogTitle>
          <DialogDescription>
            Movés el turno de {clientName} a otra fecha y hora. El sistema valida que no haya
            conflictos con otros turnos o bloqueos.
          </DialogDescription>
        </DialogHeader>

        <form action={rescheduleAppointment} className="space-y-4">
          <input type="hidden" name="id" value={id} />

          <div className="space-y-1.5">
            <Label htmlFor={`new-${id}`}>Nueva fecha y hora *</Label>
            <Input
              id={`new-${id}`}
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={toLocalDatetime(currentStartsAt)}
            />
            <p className="text-xs text-stone-500">
              Se mantiene el mismo servicio y profesional. La duración se calcula
              automáticamente.
            </p>
          </div>

          {hasPhone && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 text-sm">
              <input
                type="checkbox"
                name="notify_client"
                defaultChecked
                className="mt-0.5 h-4 w-4 accent-brand-500"
              />
              <span>
                Avisar a la clienta por WhatsApp
                <span className="block text-xs text-stone-500">
                  Le mandamos la nueva fecha y hora.
                </span>
              </span>
            </label>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingText="Reagendando...">Confirmar cambio</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
