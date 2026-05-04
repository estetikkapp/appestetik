'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { createTreatmentSession } from '@/actions/treatment-sessions';

interface ServiceOption {
  id: string;
  name: string;
}

export function TreatmentSessionForm({
  clientId,
  services,
}: {
  clientId: string;
  services: ServiceOption[];
}) {
  return (
    <form action={createTreatmentSession} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="service_id">Servicio</Label>
          <select
            id="service_id"
            name="service_id"
            defaultValue=""
            className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="">Sin servicio asociado</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="performed_at">Fecha y hora</Label>
          <Input
            id="performed_at"
            name="performed_at"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="parameters">Parámetros del tratamiento (JSON o texto)</Label>
        <Textarea
          id="parameters"
          name="parameters"
          rows={2}
          placeholder='Ej. {"joules": 18, "passes": 3, "zone": "axilas"}'
        />
        <p className="text-xs text-stone-500">
          Usá JSON si es estructurado, o texto libre. Útil para tracking de láser, peelings, etc.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="products_used">Productos usados</Label>
        <Input
          id="products_used"
          name="products_used"
          placeholder="Ej. Crema X, gel Y"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="photos_before">Fotos antes</Label>
          <input
            id="photos_before"
            name="photos_before"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-700"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photos_after">Fotos después</Label>
          <input
            id="photos_after"
            name="photos_after"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-700"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Observaciones, recomendaciones, próximo paso..." />
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton pendingText="Guardando sesión...">Registrar sesión</SubmitButton>
      </div>
    </form>
  );
}
