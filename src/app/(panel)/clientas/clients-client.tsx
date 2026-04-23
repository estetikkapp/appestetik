'use client';

import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ClientForm } from '@/components/forms/client-form';
import { createClientRecord, updateClientRecord } from '@/actions/clients';
import type { Tables } from '@/types/database';

interface Props {
  mode: 'create' | 'edit';
  client?: Tables<'clients'>;
}

export function ClientsPageClient({ mode, client }: Props) {
  const [open, setOpen] = useState(false);

  if (mode === 'create') {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva clienta
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Nueva clienta</SheetTitle>
              <SheetDescription>Cargá los datos básicos. La ficha clínica se agrega después.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <ClientForm action={createClientRecord} submitLabel="Crear clienta" />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (!client) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar clienta</SheetTitle>
            <SheetDescription>{client.full_name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ClientForm action={updateClientRecord} client={client} submitLabel="Guardar cambios" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
