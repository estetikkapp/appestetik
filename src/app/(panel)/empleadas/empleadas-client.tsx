'use client';

import { useState } from 'react';
import { Plus, Archive, ArchiveRestore, X } from 'lucide-react';
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
import {
  inviteEmployee,
  revokeInvitation,
  toggleMembershipActive,
  deleteMembership,
} from '@/actions/invitations';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import type { Tables } from '@/types/database';

type Membership = Pick<
  Tables<'memberships'>,
  'id' | 'role' | 'display_name' | 'active' | 'created_at' | 'user_id'
>;

interface Props {
  mode: 'invite' | 'toggle' | 'revoke';
  membership?: Membership;
  invitation?: Tables<'invitations'>;
}

export function EmpleadasClient({ mode, membership, invitation }: Props) {
  const [open, setOpen] = useState(false);

  if (mode === 'invite') {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invitar empleada
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Invitar nueva empleada</SheetTitle>
              <SheetDescription>
                Le llegará un email para crear su contraseña y sumarse a tu centro.
              </SheetDescription>
            </SheetHeader>
            <form action={inviteEmployee} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="empleada@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Rol *</Label>
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue=""
                  className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <option value="">Seleccioná un rol</option>
                  <option value="admin">Admin — gestiona todo menos la org</option>
                  <option value="professional">Profesional — atiende turnos</option>
                  <option value="receptionist">Recepción — gestiona clientas y turnos</option>
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <SubmitButton pendingText="Enviando...">Enviar invitación</SubmitButton>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (mode === 'toggle' && membership) {
    return (
      <div className="flex items-center justify-end gap-1">
        <form action={toggleMembershipActive}>
          <input type="hidden" name="id" value={membership.id} />
          <input type="hidden" name="active" value={String(membership.active)} />
          <SubmitButton variant="ghost" size="sm" hideSpinner>
            {membership.active ? (
              <Archive className="h-4 w-4" />
            ) : (
              <ArchiveRestore className="h-4 w-4" />
            )}
          </SubmitButton>
        </form>
        <DeleteConfirmButton
          action={deleteMembership}
          id={membership.id}
          itemLabel={`a "${membership.display_name ?? 'esta empleada'}"`}
          description="Se elimina la membresía pero la cuenta del usuario queda en Supabase Auth. No se puede eliminar si hay turnos asignados a este profesional."
        />
      </div>
    );
  }

  if (mode === 'revoke' && invitation) {
    return (
      <form action={revokeInvitation}>
        <input type="hidden" name="id" value={invitation.id} />
        <SubmitButton variant="ghost" size="sm" title="Revocar invitación" hideSpinner>
          <X className="h-4 w-4" />
        </SubmitButton>
      </form>
    );
  }

  return null;
}
