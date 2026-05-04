'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ServiceForm } from '@/components/forms/service-form';
import { createService, updateService, toggleServiceActive } from '@/actions/services';
import type { Tables } from '@/types/database';

interface Props {
  mode: 'create' | 'edit';
  service?: Tables<'services'>;
}

export function ServicesPageClient({ mode, service }: Props) {
  const [open, setOpen] = useState(false);

  if (mode === 'create') {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo servicio
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Nuevo servicio</SheetTitle>
              <SheetDescription>Agregá un servicio al catálogo.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <ServiceForm action={createService} submitLabel="Crear servicio" />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (!service) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <form action={toggleServiceActive}>
        <input type="hidden" name="id" value={service.id} />
        <input type="hidden" name="active" value={String(service.active)} />
        <SubmitButton variant="ghost" size="sm" hideSpinner>
          {service.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        </SubmitButton>
      </form>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar servicio</SheetTitle>
            <SheetDescription>{service.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ServiceForm action={updateService} service={service} submitLabel="Guardar cambios" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
