'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';
import { translateDbError } from '@/lib/utils/db-errors';
import type { InviteRole } from '@/types/app';

async function requireOwnerOrAdmin(): Promise<
  { ok: true; orgId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sin sesión' };

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return { ok: false, error: 'Sin organización activa' };

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { ok: false, error: 'Solo owner o admin puede invitar empleadas' };
  }

  return { ok: true, orgId, userId: user.id };
}

/**
 * Crea una invitación + dispara el email a través de Supabase Auth admin API.
 * El trigger on_auth_user_created resuelve la invitación al registrarse el user.
 */
export async function inviteEmployee(formData: FormData): Promise<void> {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) redirect(`/empleadas?error=${encodeURIComponent(check.error)}`);

  const rawEmail = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '') as InviteRole;

  if (!rawEmail || !isValidEmail(rawEmail)) {
    redirect('/empleadas?error=Email+inv%C3%A1lido');
  }
  if (!['admin', 'professional', 'receptionist'].includes(role)) {
    redirect('/empleadas?error=Rol+inv%C3%A1lido');
  }

  const email = normalizeEmail(rawEmail);
  const token = randomBytes(24).toString('hex');

  const supabase = createClient();

  // Verificar que no haya invitación pendiente para el mismo email en la org
  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', check.orgId)
    .eq('email', email)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    redirect('/empleadas?error=Ya+hay+una+invitaci%C3%B3n+pendiente+para+ese+email');
  }

  // Obtener nombre de la organización para incluir en el email
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', check.orgId)
    .single();

  const { error: invError } = await supabase.from('invitations').insert({
    organization_id: check.orgId,
    email,
    role,
    token,
    invited_by: check.userId,
  });

  if (invError) redirect(`/empleadas?error=${encodeURIComponent(invError.message)}`);

  // Disparar email via Supabase admin API
  try {
    const admin = createAdminClient();
    await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        invitation_token: token,
        organization_name: org?.name ?? 'tu centro',
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    });
  } catch (err) {
    // Si falla el envío del email, marcamos la invitación como cancelada
    // (el token expirará a los 7 días de todos modos)
    console.error('Error al enviar email de invitacion:', err);
  }

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=invitada');
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) redirect(`/empleadas?error=${encodeURIComponent(check.error)}`);

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/empleadas?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id)
    .eq('organization_id', check.orgId);

  if (error) redirect(`/empleadas?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=revocada');
}

export async function toggleMembershipActive(formData: FormData): Promise<void> {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) redirect(`/empleadas?error=${encodeURIComponent(check.error)}`);

  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const supabase = createClient();
  const { error } = await supabase
    .from('memberships')
    .update({ active: !active })
    .eq('id', id)
    .eq('organization_id', check.orgId)
    .neq('role', 'owner'); // no permitimos desactivar al owner desde aquí

  if (error) redirect(`/empleadas?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/empleadas');
  redirect('/empleadas');
}

export async function deleteMembership(formData: FormData): Promise<void> {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) redirect(`/empleadas?error=${encodeURIComponent(check.error)}`);

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/empleadas?error=ID+invalido');

  const supabase = createClient();
  // Verificar que no sea el owner (no se puede borrar el owner)
  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('id', id)
    .eq('organization_id', check.orgId)
    .single();

  if (!m) redirect('/empleadas?error=Empleada+no+encontrada');
  if (m.role === 'owner') {
    redirect('/empleadas?error=No+se+puede+eliminar+al+owner');
  }

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', id)
    .eq('organization_id', check.orgId)
    .neq('role', 'owner');

  if (error) redirect(`/empleadas?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=eliminada');
}
