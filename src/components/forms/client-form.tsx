'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import type { Tables } from '@/types/database';

interface ClientFormProps {
  action: (formData: FormData) => Promise<void>;
  client?: Tables<'clients'>;
  submitLabel?: string;
}

export function ClientForm({ action, client, submitLabel = 'Guardar' }: ClientFormProps) {
  return (
    <form action={action} className="space-y-4">
      {client && <input type="hidden" name="id" value={client.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="full_name">Nombre completo *</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={client?.full_name ?? ''}
          placeholder="Nombre y apellido"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone_e164">Teléfono</Label>
          <Input
            id="phone_e164"
            name="phone_e164"
            defaultValue={client?.phone_e164 ?? ''}
            placeholder="+549..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dni">DNI</Label>
          <Input
            id="dni"
            name="dni"
            defaultValue={client?.dni ?? ''}
            placeholder="12345678"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={client?.email ?? ''}
          placeholder="clienta@email.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="birthdate">Fecha de nacimiento</Label>
        <Input
          id="birthdate"
          name="birthdate"
          type="date"
          defaultValue={client?.birthdate ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas internas</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={client?.notes ?? ''}
          rows={3}
          placeholder="Visible solo para empleadas"
        />
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
