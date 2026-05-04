'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
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
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import {
  createPackage,
  updatePackage,
  togglePackageActive,
  deletePackage,
} from '@/actions/packages';
import type { Tables } from '@/types/database';

type Pkg = Tables<'packages'> & { service?: { id: string; name: string } | { id: string; name: string }[] | null };

interface ServiceOption {
  id: string;
  name: string;
}

interface Props {
  mode: 'create' | 'edit';
  pkg?: Pkg;
  services: ServiceOption[];
}

export function PackagesPageClient({ mode, pkg, services }: Props) {
  const [open, setOpen] = useState(false);

  const formContent = (
    <form
      action={mode === 'create' ? createPackage : updatePackage}
      className="space-y-4"
    >
      {pkg && <input type="hidden" name="id" value={pkg.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={pkg?.name ?? ''}
          placeholder="Ej. 10 sesiones láser axilas"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={pkg?.description ?? ''}
          placeholder="Qué incluye, condiciones, etc."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="service_id">Servicio asociado</Label>
        <select
          id="service_id"
          name="service_id"
          defaultValue={pkg?.service_id ?? ''}
          className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <option value="">Sin servicio asociado (bono libre)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          Si lo asociás, se descuenta auto al crear turnos de ese servicio.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sessions_total">Sesiones *</Label>
          <Input
            id="sessions_total"
            name="sessions_total"
            type="number"
            min={1}
            required
            defaultValue={pkg?.sessions_total ?? 10}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="validity_days">Validez (días)</Label>
          <Input
            id="validity_days"
            name="validity_days"
            type="number"
            min={1}
            defaultValue={pkg?.validity_days ?? 365}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount_percentage">Descuento %</Label>
          <Input
            id="discount_percentage"
            name="discount_percentage"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={pkg?.discount_percentage ?? 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="price_ars">Precio total (ARS) *</Label>
        <Input
          id="price_ars"
          name="price_ars"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={pkg?.price_ars ?? 0}
        />
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton pendingText="Guardando...">
          {mode === 'create' ? 'Crear paquete' : 'Guardar cambios'}
        </SubmitButton>
      </div>
    </form>
  );

  if (mode === 'create') {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo paquete
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Nuevo paquete</SheetTitle>
              <SheetDescription>Sesiones prepagas con descuento y vencimiento.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">{formContent}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (!pkg) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <form action={togglePackageActive}>
        <input type="hidden" name="id" value={pkg.id} />
        <input type="hidden" name="active" value={String(pkg.active)} />
        <SubmitButton variant="ghost" size="sm" hideSpinner>
          {pkg.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        </SubmitButton>
      </form>
      <DeleteConfirmButton
        action={deletePackage}
        id={pkg.id}
        itemLabel={`el paquete "${pkg.name}"`}
        description="Si hay clientas con este paquete asignado, no se podrá borrar — usá Archivar."
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar paquete</SheetTitle>
            <SheetDescription>{pkg.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">{formContent}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
