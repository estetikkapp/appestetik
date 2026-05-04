'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createResource, updateResource, toggleResourceActive, deleteResource } from '@/actions/resources';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import type { Tables } from '@/types/database';

const TYPES = [
  { value: 'cabin', label: 'Cabina' },
  { value: 'laser', label: 'Máquina láser' },
  { value: 'radiofrequency', label: 'Radiofrecuencia' },
  { value: 'ultrasound', label: 'Ultrasonido' },
  { value: 'mesotherapy', label: 'Mesoterapia' },
  { value: 'other', label: 'Otro' },
];

interface Props {
  mode: 'create' | 'edit';
  resource?: Tables<'resources'>;
}

export function ResourcesClient({ mode, resource }: Props) {
  const [open, setOpen] = useState(false);

  const ResourceForm = (
    <form
      action={mode === 'create' ? createResource : updateResource}
      className="space-y-4"
    >
      {resource && <input type="hidden" name="id" value={resource.id} />}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={resource?.name ?? ''}
          placeholder="Ej. Cabina 1"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">Tipo *</Label>
        <select
          id="type"
          name="type"
          required
          defaultValue={resource?.type ?? ''}
          className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <option value="">Seleccioná un tipo</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end pt-2">
        <SubmitButton pendingText="Guardando...">
          {mode === 'create' ? 'Crear recurso' : 'Guardar cambios'}
        </SubmitButton>
      </div>
    </form>
  );

  if (mode === 'create') {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo recurso
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Nuevo recurso</SheetTitle>
              <SheetDescription>Cabina, máquina u otro recurso asignable a turnos.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">{ResourceForm}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (!resource) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <form action={toggleResourceActive}>
        <input type="hidden" name="id" value={resource.id} />
        <input type="hidden" name="active" value={String(resource.active)} />
        <SubmitButton variant="ghost" size="sm" hideSpinner>
          {resource.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        </SubmitButton>
      </form>
      <DeleteConfirmButton
        action={deleteResource}
        id={resource.id}
        itemLabel={`el recurso "${resource.name}"`}
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar recurso</SheetTitle>
            <SheetDescription>{resource.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">{ResourceForm}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
