'use client';

import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { assignPackageToClient } from '@/actions/packages';
import { formatArs } from '@/lib/utils/format-ars';

interface AvailablePackage {
  id: string;
  name: string;
  sessions_total: number;
  price_ars: number;
}

export function AssignPackageForm({
  clientId,
  availablePackages,
}: {
  clientId: string;
  availablePackages: AvailablePackage[];
}) {
  return (
    <form action={assignPackageToClient} className="flex w-full flex-wrap items-end gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="package_id">Paquete a asignar</Label>
        <select
          id="package_id"
          name="package_id"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <option value="">Seleccioná un paquete</option>
          {availablePackages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.sessions_total} sesiones · {formatArs(Number(p.price_ars))}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingText="Asignando...">Asignar</SubmitButton>
    </form>
  );
}
