'use client';

import { useState } from 'react';
import { Banknote, Link as LinkIcon } from 'lucide-react';
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
import { recordManualPayment, createMpPaymentLink } from '@/actions/payments';

interface ClientOption {
  id: string;
  full_name: string;
  email: string | null;
}

export function CobrosClient({
  clients,
  mpConfigured,
}: {
  clients: ClientOption[];
  mpConfigured: boolean;
}) {
  const [open, setOpen] = useState<'manual' | 'mp' | null>(null);

  return (
    <div className="flex gap-2">
      <Button onClick={() => setOpen('manual')}>
        <Banknote className="mr-2 h-4 w-4" />
        Registrar pago
      </Button>
      <Button
        variant="premium"
        onClick={() => setOpen('mp')}
        disabled={!mpConfigured}
        title={!mpConfigured ? 'MP no configurado' : 'Crear link de pago MP'}
      >
        <LinkIcon className="mr-2 h-4 w-4" />
        Link MP
      </Button>

      <Sheet open={open === 'manual'} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Registrar pago manual</SheetTitle>
            <SheetDescription>Efectivo, transferencia, etc.</SheetDescription>
          </SheetHeader>
          <form action={recordManualPayment} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client_id_m">Clienta *</Label>
              <select
                id="client_id_m"
                name="client_id"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount_m">Monto (ARS) *</Label>
              <Input id="amount_m" name="amount_ars" type="number" min={1} step="0.01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method_m">Método *</Label>
              <select
                id="method_m"
                name="method"
                required
                defaultValue="cash"
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="mp_card">MP tarjeta presencial</option>
                <option value="package_credit">Crédito de paquete</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes_m">Notas</Label>
              <Textarea id="notes_m" name="notes" rows={2} />
            </div>
            <div className="flex justify-end pt-2">
              <SubmitButton pendingText="Registrando...">Registrar</SubmitButton>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={open === 'mp'} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Crear link de pago MP</SheetTitle>
            <SheetDescription>
              Generá un link de Mercado Pago para enviar a la clienta.
            </SheetDescription>
          </SheetHeader>
          <form action={createMpPaymentLink} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client_id_mp">Clienta *</Label>
              <select
                id="client_id_mp"
                name="client_id"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.email ? ` (${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount_mp">Monto (ARS) *</Label>
              <Input id="amount_mp" name="amount_ars" type="number" min={1} step="0.01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description_mp">Descripción</Label>
              <Input
                id="description_mp"
                name="description"
                placeholder="Ej. Limpieza facial"
                defaultValue="Servicio estética"
              />
            </div>
            <div className="flex justify-end pt-2">
              <SubmitButton pendingText="Generando link...">
                Generar link MP
              </SubmitButton>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
