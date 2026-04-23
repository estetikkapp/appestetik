'use client';

import { useState } from 'react';
import { Plus, Archive, ArchiveRestore, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from '@/actions/invitations';
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
                <Button type="submit">Enviar invitación</Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (mode === 'toggle' && membership) {
    return (
      <form action={toggleMembershipActive}>
        <input type="hidden" name="id" value={membership.id} />
        <input type="hidden" name="active" value={String(membership.active)} />
        <Button variant="ghost" size="sm" type="submit">
          {membership.active ? (
            <Archive className="h-4 w-4" />
          ) : (
            <ArchiveRestore className="h-4 w-4" />
          )}
        </Button>
      </form>
    );
  }

  if (mode === 'revoke' && invitation) {
    return (
      <form action={revokeInvitation}>
        <input type="hidden" name="id" value={invitation.id} />
        <Button variant="ghost" size="sm" type="submit" title="Revocar invitación">
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  return null;
}
