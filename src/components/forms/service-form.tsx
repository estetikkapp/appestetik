'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { Tables } from '@/types/database';

const CATEGORIES = ['depilacion', 'facial', 'corporal', 'unias', 'masajes', 'otro'];
const CATEGORY_LABELS: Record<string, string> = {
  depilacion: 'Depilación',
  facial: 'Facial',
  corporal: 'Corporal',
  unias: 'Uñas',
  masajes: 'Masajes',
  otro: 'Otro',
};

interface ServiceFormProps {
  action: (formData: FormData) => Promise<void>;
  service?: Tables<'services'>;
  submitLabel?: string;
}

export function ServiceForm({ action, service, submitLabel = 'Guardar' }: ServiceFormProps) {
  return (
    <form action={action} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre *</Label>
        <Input id="name" name="name" required defaultValue={service?.name ?? ''} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Categoría</Label>
        <select
          id="category"
          name="category"
          defaultValue={service?.category ?? ''}
          className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <option value="">Sin categoría</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={service?.description ?? ''}
          rows={3}
          placeholder="Qué incluye el servicio (opcional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="duration_minutes">Duración (min) *</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={1}
            step={5}
            required
            defaultValue={service?.duration_minutes ?? 60}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="buffer_minutes">Buffer después (min)</Label>
          <Input
            id="buffer_minutes"
            name="buffer_minutes"
            type="number"
            min={0}
            step={5}
            defaultValue={service?.buffer_minutes ?? 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="price_ars">Precio (ARS) *</Label>
        <Input
          id="price_ars"
          name="price_ars"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={service?.price_ars ?? 0}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 p-3">
        <input
          type="checkbox"
          name="requires_consent"
          defaultChecked={service?.requires_consent ?? false}
          className="h-4 w-4 accent-brand-500"
        />
        <div>
          <span className="text-sm font-medium">Requiere consentimiento informado</span>
          <p className="text-xs text-stone-500">
            La clienta debe firmar antes de la primera sesión (láser, peeling, dermapen).
          </p>
        </div>
      </label>

      <div className="flex justify-end pt-2">
        <SubmitButton pendingText="Guardando...">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
