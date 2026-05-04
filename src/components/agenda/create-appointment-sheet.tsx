'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createAppointment } from '@/actions/appointments';

interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  services: Option[];
  clients: Option[];
  professionals: Option[];
  resources: Option[];
  defaultDate?: string; // YYYY-MM-DD
}

export function CreateAppointmentSheet({
  services,
  clients,
  professionals,
  resources,
  defaultDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const defaultDateTime = defaultDate ? `${defaultDate}T10:00` : '';

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Nuevo turno
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuevo turno</SheetTitle>
            <SheetDescription>
              Detectamos conflictos de horario con profesional y recurso.
            </SheetDescription>
          </SheetHeader>
          <form action={createAppointment} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client_id">Clienta *</Label>
              <SelectNative id="client_id" name="client_id" required options={clients} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="service_id">Servicio *</Label>
              <SelectNative id="service_id" name="service_id" required options={services} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="professional_id">Profesional</Label>
                <SelectNative
                  id="professional_id"
                  name="professional_id"
                  options={professionals}
                  emptyLabel="Cualquiera"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resource_id">Recurso</Label>
                <SelectNative
                  id="resource_id"
                  name="resource_id"
                  options={resources}
                  emptyLabel="Ninguno"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="starts_at">Fecha y hora de inicio *</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={defaultDateTime}
              />
              <p className="text-xs text-stone-500">
                El sistema calcula el horario de fin según la duración del servicio.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Opcional" />
            </div>

            <div className="flex justify-end pt-2">
              <SubmitButton pendingText="Creando turno...">Crear turno</SubmitButton>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SelectNative({
  id,
  name,
  required,
  options,
  emptyLabel = 'Seleccionar',
}: {
  id: string;
  name: string;
  required?: boolean;
  options: Option[];
  emptyLabel?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      defaultValue=""
      className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <option value="">{emptyLabel}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
          {opt.sublabel ? ` — ${opt.sublabel}` : ''}
        </option>
      ))}
    </select>
  );
}
