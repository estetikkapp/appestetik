'use client';

import { Check, Play, CheckCircle, X, UserX, Bell } from 'lucide-react';
import { SubmitButton } from '@/components/ui/submit-button';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import {
  updateAppointmentStatus,
  deleteAppointment,
  sendReminderNow,
} from '@/actions/appointments';
import type { AppointmentStatus } from '@/types/app';
import { RescheduleButton } from './reschedule-button';

interface Props {
  id: string;
  status: AppointmentStatus;
  /** Para el reschedule modal — opcional para retrocompat */
  startsAt?: string;
  clientName?: string;
  hasPhone?: boolean;
  reminderSentAt?: string | null;
}

export function AppointmentRowActions({
  id,
  status,
  startsAt,
  clientName,
  hasPhone,
  reminderSentAt,
}: Props) {
  const canReschedule = ['pending', 'confirmed'].includes(status) && !!startsAt;
  const canRemind = ['pending', 'confirmed'].includes(status);
  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      {status === 'pending' && (
        <StatusButton id={id} toStatus="confirmed" title="Confirmar">
          <Check className="h-4 w-4" />
        </StatusButton>
      )}
      {(status === 'pending' || status === 'confirmed') && (
        <StatusButton id={id} toStatus="in_progress" title="Check-in">
          <Play className="h-4 w-4" />
        </StatusButton>
      )}
      {(status === 'in_progress' || status === 'confirmed') && (
        <StatusButton id={id} toStatus="completed" title="Completar">
          <CheckCircle className="h-4 w-4" />
        </StatusButton>
      )}
      {canRemind && (
        <form action={sendReminderNow}>
          <input type="hidden" name="id" value={id} />
          {reminderSentAt && <input type="hidden" name="force" value="1" />}
          <SubmitButton
            variant="ghost"
            size="sm"
            title={reminderSentAt ? 'Reenviar recordatorio' : 'Enviar recordatorio ahora'}
            aria-label="Recordatorio"
            hideSpinner
          >
            <Bell
              className={`h-4 w-4 ${reminderSentAt ? 'text-emerald-600' : ''}`}
            />
          </SubmitButton>
        </form>
      )}
      {canReschedule && (
        <RescheduleButton
          id={id}
          currentStartsAt={startsAt!}
          clientName={clientName ?? 'la clienta'}
          hasPhone={!!hasPhone}
        />
      )}
      {['pending', 'confirmed', 'in_progress'].includes(status) && (
        <StatusButton id={id} toStatus="cancelled" title="Cancelar" variant="destructive">
          <X className="h-4 w-4" />
        </StatusButton>
      )}
      {['pending', 'confirmed'].includes(status) && (
        <StatusButton id={id} toStatus="no_show" title="No vino" variant="destructive">
          <UserX className="h-4 w-4" />
        </StatusButton>
      )}
      <DeleteConfirmButton
        action={deleteAppointment}
        id={id}
        itemLabel="este turno"
        description="Esta acción borra el turno permanentemente. Si querés mantener el historial, mejor cancelarlo."
      />
    </div>
  );
}

function StatusButton({
  id,
  toStatus,
  title,
  children,
}: {
  id: string;
  toStatus: AppointmentStatus;
  title: string;
  children: React.ReactNode;
  variant?: 'ghost' | 'destructive';
}) {
  return (
    <form action={updateAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={toStatus} />
      <SubmitButton variant="ghost" size="sm" title={title} aria-label={title} hideSpinner>
        {children}
      </SubmitButton>
    </form>
  );
}
