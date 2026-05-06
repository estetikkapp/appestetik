'use client';

import * as React from 'react';
import { MessageCircle, Check, Ban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  notifyWaitlistEntry,
  markWaitlistBooked,
  cancelWaitlistEntry,
  deleteWaitlistEntry,
} from '@/actions/waitlist';

interface Props {
  id: string;
  status: 'waiting' | 'notified' | 'booked' | 'cancelled';
  clientName: string;
  serviceName: string;
  hasPhone: boolean;
}

export function WaitlistRowActions({ id, status, clientName, serviceName, hasPhone }: Props) {
  const [notifyOpen, setNotifyOpen] = React.useState(false);

  const isTerminal = status === 'booked' || status === 'cancelled';

  return (
    <div className="flex items-center justify-end gap-1">
      {!isTerminal && (
        <>
          <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                title={hasPhone ? 'Avisar por WhatsApp' : 'Marcar como avisada (manual)'}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Avisar a {clientName}</DialogTitle>
                <DialogDescription>
                  {hasPhone
                    ? `Vamos a mandarle un WhatsApp avisando que se liberó un turno para ${serviceName}. Podés personalizar el mensaje.`
                    : `Esta clienta no tiene teléfono cargado, así que la marcaremos como avisada en el sistema (asumimos que la contactás vos por otro medio).`}
                </DialogDescription>
              </DialogHeader>

              <form action={notifyWaitlistEntry} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                {hasPhone && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`message-${id}`}>Mensaje (opcional)</Label>
                    <Textarea
                      id={`message-${id}`}
                      name="message"
                      rows={4}
                      placeholder={`Hola ${clientName} 👋\n\nTe avisamos que se liberó un turno para ${serviceName}. Si querés tomarlo, respondé este mensaje.`}
                    />
                    <p className="text-xs text-stone-500">
                      Si lo dejás vacío, mandamos uno por defecto.
                    </p>
                  </div>
                )}

                <DialogFooter className="gap-2">
                  <Button variant="outline" type="button" onClick={() => setNotifyOpen(false)}>
                    Cancelar
                  </Button>
                  <SubmitButton pendingText="Enviando...">
                    {hasPhone ? 'Enviar WhatsApp' : 'Marcar como avisada'}
                  </SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <form action={markWaitlistBooked}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton
              variant="ghost"
              size="sm"
              hideSpinner
              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              title="Marcar como reservada (le hicieron el turno)"
            >
              <Check className="h-4 w-4" />
            </SubmitButton>
          </form>

          <form action={cancelWaitlistEntry}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton
              variant="ghost"
              size="sm"
              hideSpinner
              className="text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              title="Cancelar (la clienta ya no espera)"
            >
              <Ban className="h-4 w-4" />
            </SubmitButton>
          </form>
        </>
      )}

      <DeleteRow id={id} />
    </div>
  );
}

function DeleteRow({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Eliminar"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar esta entrada?</DialogTitle>
          <DialogDescription>
            Se elimina del registro. Si querés conservar el historial, usá Cancelar en su lugar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Cancelar
          </Button>
          <form action={deleteWaitlistEntry}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="destructive" pendingText="Eliminando...">
              Eliminar
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
