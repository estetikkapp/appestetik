'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface DeleteConfirmButtonProps {
  /** Server Action que realiza la eliminación. Debe leer "id" del FormData. */
  action: (formData: FormData) => Promise<void>;
  /** ID del registro a borrar */
  id: string;
  /** Etiqueta para el dialog. Ej: "este servicio" o "el turno de María" */
  itemLabel: string;
  /**
   * Texto explicativo opcional. Si no se da, default genérico.
   * Útil para advertencias específicas (ej: "Si tiene turnos asociados,
   * no se podrá borrar — usá Archivar en su lugar").
   */
  description?: string;
  /** Ocultar el texto y mostrar solo el ícono (útil en row actions) */
  iconOnly?: boolean;
  /** Tamaño del botón trigger */
  triggerSize?: 'sm' | 'default';
}

export function DeleteConfirmButton({
  action,
  id,
  itemLabel,
  description,
  iconOnly = true,
  triggerSize = 'sm',
}: DeleteConfirmButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={triggerSize}
          title="Eliminar"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          {!iconOnly && <span className="ml-2">Eliminar</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar {itemLabel}?</DialogTitle>
          <DialogDescription>
            {description ??
              'Esta acción no se puede deshacer. Si querés conservar el historial, usá Archivar en su lugar.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Cancelar
          </Button>
          <form action={action}>
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
