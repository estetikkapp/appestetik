'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';
import { translateDbError } from '@/lib/utils/db-errors';
import { sendEmail } from '@/lib/integrations/email/resend';
import { invitationEmail } from '@/lib/integrations/email/templates';
import { requireMembership } from '@/lib/auth/require-membership';
import { audit } from '@/lib/audit';
import { getOrgFeatureContext } from '@/lib/plans/subscription-service';
import { canAccessFeature } from '@/lib/plans/feature-flags';
import { PLANS } from '@/lib/plans/definitions';
import { createAdminClient } from '@/lib/supabase/admin';
import type { InviteRole } from '@/types/app';

/**
 * Crea una invitación + dispara email vía Resend (no Supabase Auth mailer —
 * éste tiene rate limits muy bajos y entrega inconsistente).
 *
 * Flow:
 *   1. Crear invitations row con token random
 *   2. Mandar email con link a /auth/signup?invite=TOKEN&email=EMAIL
 *   3. La invitada abre el link, signup precompletado (email read-only)
 *   4. Al hacer signUp, supabase recibe `invitation_token` en raw_user_meta_data
 *   5. Trigger DB handle_new_user() valida token + crea membership con rol
 */
export async function inviteEmployee(formData: FormData): Promise<void> {
  // requireMembership con minRole admin (solo owner/admin pueden invitar)
  const { orgId, userId } = await requireMembership({ minRole: 'admin' });

  // Gating por plan: defensa en profundidad. Aunque la UI esconda el botón
  // de invitar para Gabinete, validamos también acá por si alguien postea
  // directo (cURL, scripts) o si las pages no aplican el guard.
  const { subscription, isGrandfathered } = await getOrgFeatureContext(orgId);
  if (subscription) {
    const ctx = { planId: subscription.plan_id, isGrandfathered };
    if (!canAccessFeature(ctx, 'multi_usuario')) {
      redirect('/precios?from=multi_usuario');
    }

    // Enforcement del límite de usuarios del plan (ej. Gabinete = 1, Equipo = 5)
    const limit = PLANS[subscription.plan_id]?.limits.users;
    if (limit !== null && limit !== undefined && !isGrandfathered) {
      const admin = createAdminClient();
      const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
        admin
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('active', true),
        admin
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('accepted_at', null)
          .gte('expires_at', new Date().toISOString()),
      ]);
      const totalUsers = (activeCount ?? 0) + (pendingCount ?? 0);
      if (totalUsers >= limit) {
        redirect(
          `/empleadas?error=${encodeURIComponent(
            `Llegaste al límite de ${limit} usuario${limit === 1 ? '' : 's'} de tu plan. Subí a Equipo para sumar más.`
          )}`
        );
      }
    }
  }

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
    .eq('organization_id', orgId)
    .eq('email', email)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    redirect('/empleadas?error=Ya+hay+una+invitaci%C3%B3n+pendiente+para+ese+email');
  }

  // Cargar contexto: nombre de la org + nombre de quien invita
  const [{ data: org }, { data: inviter }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', orgId).single(),
    supabase
      .from('memberships')
      .select('display_name')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .maybeSingle(),
  ]);

  // Crear invitation row
  const { error: invError } = await supabase.from('invitations').insert({
    organization_id: orgId,
    email,
    role,
    token,
    invited_by: userId,
  });

  if (invError) redirect(`/empleadas?error=${encodeURIComponent(translateDbError(invError))}`);

  // Disparar email via Resend
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';
  const acceptUrl =
    `${baseUrl}/auth/signup?invite=${encodeURIComponent(token)}` +
    `&email=${encodeURIComponent(email)}`;

  const tpl = invitationEmail({
    inviteeName: null,
    orgName: org?.name ?? 'tu centro',
    inviterName: inviter?.display_name ?? null,
    acceptUrl,
    role,
  });

  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: undefined, // si el FROM es noreply@, el reply rebota — OK por ahora
    tags: [
      { name: 'type', value: 'invitation' },
      { name: 'org_id', value: orgId },
    ],
  });

  if (!result.ok) {
    // Si el email falló, dejamos la invitation en DB pero avisamos al user.
    // El owner puede reenviar manualmente desde la UI (revoke + invite again).
    console.error('[invitations] email send failed:', result.code, result.error);

    await audit({
      organizationId: orgId,
      action: 'invitation.send.failed',
      entityType: 'invitation',
      entityId: token.slice(0, 12),
      payload: {
        email,
        role,
        error_code: result.code ?? 'unknown',
        error: result.error ?? null,
      },
    });

    redirect(
      `/empleadas?error=${encodeURIComponent(
        `Invitación creada pero el email falló: ${result.code === 'no_api_key' ? 'falta RESEND_API_KEY' : result.error}. La invitada puede entrar igual con este link manual: ${acceptUrl.slice(0, 80)}...`
      )}`
    );
  }

  await audit({
    organizationId: orgId,
    action: 'invitation.create',
    entityType: 'invitation',
    entityId: token.slice(0, 12),
    payload: { email, role },
  });

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=invitada');
}

/**
 * Reenvío de un email de invitación existente (no crea otra row).
 */
export async function resendInvitation(formData: FormData): Promise<void> {
  const { orgId, userId } = await requireMembership({ minRole: 'admin' });

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/empleadas?error=ID+invalido');

  const supabase = createClient();

  const { data: inv } = await supabase
    .from('invitations')
    .select('email, role, token, expires_at, accepted_at')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!inv) redirect('/empleadas?error=Invitaci%C3%B3n+no+encontrada');
  if (inv.accepted_at) redirect('/empleadas?error=Ya+fue+aceptada');
  if (new Date(inv.expires_at) < new Date()) {
    redirect('/empleadas?error=Invitaci%C3%B3n+vencida.+Cancelala+y+volv%C3%A9+a+invitar');
  }

  const [{ data: org }, { data: inviter }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', orgId).single(),
    supabase
      .from('memberships')
      .select('display_name')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .maybeSingle(),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';
  const acceptUrl =
    `${baseUrl}/auth/signup?invite=${encodeURIComponent(inv.token)}` +
    `&email=${encodeURIComponent(inv.email)}`;

  const tpl = invitationEmail({
    inviteeName: null,
    orgName: org?.name ?? 'tu centro',
    inviterName: inviter?.display_name ?? null,
    acceptUrl,
    role: inv.role,
  });

  const result = await sendEmail({
    to: inv.email,
    subject: `[Reenvío] ${tpl.subject}`,
    html: tpl.html,
    text: tpl.text,
    tags: [
      { name: 'type', value: 'invitation_resend' },
      { name: 'org_id', value: orgId },
    ],
  });

  if (!result.ok) {
    redirect(
      `/empleadas?error=${encodeURIComponent('Reenvío falló: ' + (result.error ?? result.code))}`
    );
  }

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=reenviada');
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const { orgId } = await requireMembership({ minRole: 'admin' });

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/empleadas?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/empleadas?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=revocada');
}

export async function toggleMembershipActive(formData: FormData): Promise<void> {
  const { orgId } = await requireMembership({ minRole: 'admin' });

  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const supabase = createClient();
  const { error } = await supabase
    .from('memberships')
    .update({ active: !active })
    .eq('id', id)
    .eq('organization_id', orgId)
    .neq('role', 'owner'); // no permitimos desactivar al owner desde aquí

  if (error) redirect(`/empleadas?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/empleadas');
  redirect('/empleadas');
}

export async function deleteMembership(formData: FormData): Promise<void> {
  const { orgId } = await requireMembership({ minRole: 'admin' });

  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/empleadas?error=ID+invalido');

  const supabase = createClient();
  // Verificar que no sea el owner (no se puede borrar el owner)
  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single();

  if (!m) redirect('/empleadas?error=Empleada+no+encontrada');
  if (m.role === 'owner') {
    redirect('/empleadas?error=No+se+puede+eliminar+al+owner');
  }

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .neq('role', 'owner');

  if (error) redirect(`/empleadas?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=eliminada');
}
