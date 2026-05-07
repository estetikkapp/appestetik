'use client';

import { useState } from 'react';
import { Plus, Archive, ArchiveRestore, X, Settings2, Send } from 'lucide-react';
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
  resendInvitation,
  revokeInvitation,
  toggleMembershipActive,
  deleteMembership,
} from '@/actions/invitations';
import { assignTemplateToMembership } from '@/actions/schedule-templates';
import { setProfessionalServices } from '@/actions/professional-services';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import type { Tables } from '@/types/database';

type Membership = Pick<
  Tables<'memberships'>,
  'id' | 'role' | 'display_name' | 'active' | 'created_at' | 'user_id'
> & { schedule_template_id?: string | null };

interface Props {
  mode: 'invite' | 'toggle' | 'revoke' | 'config';
  membership?: Membership;
  invitation?: Tables<'invitations'>;
  templates?: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string }>;
  assignedServiceIds?: string[];
}

export function EmpleadasClient({
  mode,
  membership,
  invitation,
  templates,
  services,
  assignedServiceIds,
}: Props) {
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
      <div className="flex items-center justify-end gap-1">
        <form action={resendInvitation}>
          <input type="hidden" name="id" value={invitation.id} />
          <SubmitButton
            variant="ghost"
            size="sm"
            title="Reenviar email de invitación"
            aria-label="Reenviar email de invitación"
            hideSpinner
          >
            <Send className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </SubmitButton>
        </form>
        <form action={revokeInvitation}>
          <input type="hidden" name="id" value={invitation.id} />
          <SubmitButton
            variant="ghost"
            size="sm"
            title="Revocar invitación"
            aria-label="Revocar invitación"
            hideSpinner
          >
            <X className="h-4 w-4 text-red-600" aria-hidden="true" />
          </SubmitButton>
        </form>
      </div>
    );
  }

  if (mode === 'config' && membership) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          title="Configurar plantilla y servicios"
          onClick={() => setOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Configurar {membership.display_name ?? 'empleada'}</SheetTitle>
              <SheetDescription>
                Plantilla de horarios y servicios que ofrece.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <form action={assignTemplateToMembership} className="space-y-3">
                <input type="hidden" name="membership_id" value={membership.id} />
                <Label htmlFor="schedule_template_id">Plantilla de horarios</Label>
                <select
                  id="schedule_template_id"
                  name="schedule_template_id"
                  defaultValue={membership.schedule_template_id ?? ''}
                  className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <option value="">Sin plantilla (no aparece en reservas públicas)</option>
                  {(templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-stone-500">
                  ¿Falta la plantilla?{' '}
                  <a href="/horarios" className="text-brand-600 hover:underline">
                    Crearla en Horarios →
                  </a>
                </p>
                <div className="flex justify-end">
                  <SubmitButton pendingText="Guardando...">Guardar plantilla</SubmitButton>
                </div>
              </form>

              <hr className="border-stone-200" />

              <form action={setProfessionalServices} className="space-y-3">
                <input type="hidden" name="membership_id" value={membership.id} />
                <Label>Servicios que ofrece</Label>
                <p className="text-xs text-stone-500">
                  Si no seleccionás ninguno, ofrece <strong>todos</strong> los servicios del centro.
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
                  {(services ?? []).length === 0 && (
                    <p className="p-2 text-xs text-stone-400">No hay servicios cargados.</p>
                  )}
                  {(services ?? []).map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        name="service_ids"
                        value={s.id}
                        defaultChecked={(assignedServiceIds ?? []).includes(s.id)}
                        className="h-4 w-4 accent-brand-500"
                      />
                      <span className="text-sm">{s.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <SubmitButton pendingText="Guardando...">Guardar servicios</SubmitButton>
                </div>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return null;
}
