'use client';

import { Check, Play, CheckCircle, X, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateAppointmentStatus } from '@/actions/appointments';
import type { AppointmentStatus } from '@/types/app';

interface Props {
  id: string;
  status: AppointmentStatus;
}

export function AppointmentRowActions({ id, status }: Props) {
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
    </div>
  );
}

function StatusButton({
  id,
  toStatus,
  title,
  children,
  variant = 'ghost',
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
      <Button variant={variant === 'destructive' ? 'ghost' : 'ghost'} size="sm" type="submit" title={title}>
        {children}
      </Button>
    </form>
  );
}
