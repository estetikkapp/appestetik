'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { addToWaitlist } from '@/actions/waitlist';

interface ClientOption {
  id: string;
  full_name: string;
  phone_e164: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
}

export function WaitlistAddDialog({
  clients,
  services,
}: {
  clients: ClientOption[];
  services: ServiceOption[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Agregar a la lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar a lista de espera</DialogTitle>
          <DialogDescription>
            Cuando se libere un turno para esa clienta y ese servicio, vas a poder avisarle en un click.
          </DialogDescription>
        </DialogHeader>

        <form action={addToWaitlist} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client_id">Clienta *</Label>
            <select
              id="client_id"
              name="client_id"
              required
              defaultValue=""
              className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <option value="" disabled>
                Elegí una clienta...
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                  {c.phone_e164 ? ` · ${c.phone_e164}` : ' · sin teléfono'}
                </option>
              ))}
            </select>
            {clients.length === 0 && (
              <p className="text-xs text-stone-500">
                No hay clientas cargadas todavía. Creá una en{' '}
                <a href="/clientas" className="text-brand-600 underline">
                  Clientas
                </a>
                .
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service_id">Servicio *</Label>
            <select
              id="service_id"
              name="service_id"
              required
              defaultValue=""
              className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <option value="" disabled>
                Elegí un servicio...
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preferred_date">Fecha preferida (opcional)</Label>
            <Input id="preferred_date" name="preferred_date" type="date" />
            <p className="text-xs text-stone-500">
              Si la clienta tiene preferencia por un día. Dejalo vacío si le sirve cualquier fecha.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Ej. Solo a la mañana, prefiere a María, etc."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingText="Guardando...">Agregar</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
