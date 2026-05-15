'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyOrgAdmins } from '@/lib/notifications';
import { audit } from '@/lib/audit';

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min después de 3 intentos fallidos
const NO_CANCEL_HOURS = 24; // no permitir cancelar dentro de las 24hs previas al turno

/**
 * Cancela un turno desde la URL pública usando el security code.
 *
 * Flow:
 * 1. Valida que el turno exista y esté en estado cancelable
 * 2. Verifica si está dentro del período de cooldown por intentos previos
 * 3. Verifica security_code con bcrypt
 * 4. Si OK → cancela + guarda razón + manda WhatsApp confirmación
 * 5. Si KO → incrementa attempts + redirect con error
 */
export async function cancelAppointmentPublic(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!id) redirect('/?error=Turno+invalido');
  if (!code || !/^\d{6}$/.test(code)) {
    redirect(`/turno/${id}/cancelar?error=C%C3%B3digo+inv%C3%A1lido`);
  }
  if (!reason || reason.length < 3) {
    redirect(`/turno/${id}/cancelar?error=Decinos+por+qu%C3%A9+lo+cancel%C3%A1s+%283%2B+caracteres%29`);
  }

  const supabase = createAdminClient();

  const { data: appt } = await supabase
    .from('appointments')
    .select(
      'id, status, starts_at, security_code_hash, cancellation_attempts, last_cancellation_attempt_at, organization_id, client_id'
    )
    .eq('id', id)
    .maybeSingle();

  if (!appt) redirect(`/turno/${id}/cancelar?error=Turno+no+encontrado`);

  if (appt.status !== 'pending' && appt.status !== 'confirmed') {
    redirect(`/turno/${id}/cancelar?error=Este+turno+no+se+puede+cancelar+%28estado+${appt.status}%29`);
  }

  // No permitir cancelar muy cerca del turno
  const startMs = new Date(appt.starts_at).getTime();
  if (startMs - Date.now() < NO_CANCEL_HOURS * 60 * 60 * 1000) {
    redirect(
      `/turno/${id}/cancelar?error=No+se+puede+cancelar+menos+de+${NO_CANCEL_HOURS}hs+antes.+Llam%C3%A1+al+centro.`
    );
  }

  // Cooldown si ya hubo 3+ intentos
  if (
    appt.cancellation_attempts >= MAX_ATTEMPTS &&
    appt.last_cancellation_attempt_at
  ) {
    const lastMs = new Date(appt.last_cancellation_attempt_at).getTime();
    if (Date.now() - lastMs < COOLDOWN_MS) {
      const remainingMin = Math.ceil((COOLDOWN_MS - (Date.now() - lastMs)) / 60000);
      redirect(
        `/turno/${id}/cancelar?error=Demasiados+intentos.+Esperá+${remainingMin}+minutos.`
      );
    }
    // Cooldown vencido: resetear el counter
    await supabase
      .from('appointments')
      .update({ cancellation_attempts: 0 })
      .eq('id', id);
  }

  if (!appt.security_code_hash) {
    redirect(`/turno/${id}/cancelar?error=Este+turno+no+tiene+c%C3%B3digo+de+cancelaci%C3%B3n`);
  }

  const ok = await bcrypt.compare(code, appt.security_code_hash);

  if (!ok) {
    await supabase
      .from('appointments')
      .update({
        cancellation_attempts: appt.cancellation_attempts + 1,
        last_cancellation_attempt_at: new Date().toISOString(),
      })
      .eq('id', id);
    const remaining = MAX_ATTEMPTS - (appt.cancellation_attempts + 1);
    redirect(
      `/turno/${id}/cancelar?error=C%C3%B3digo+incorrecto.+Te+quedan+${Math.max(0, remaining)}+intentos.`
    );
  }

  // Cancelar
  const { error: cancelErr } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: `[Clienta] ${reason}`,
    })
    .eq('id', id);

  if (cancelErr) {
    redirect(`/turno/${id}/cancelar?error=${encodeURIComponent(cancelErr.message)}`);
  }

  // Audit + notif a admins (best-effort)
  await Promise.all([
    audit({
      organizationId: appt.organization_id,
      action: 'appointment.cancel.public',
      entityType: 'appointment',
      entityId: id,
      payload: { reason },
      actorLabel: 'clienta',
    }),
    notifyOrgAdmins(
      appt.organization_id,
      'appointment_cancelled_by_client',
      'Turno cancelado por la clienta',
      `Motivo: ${reason}`,
      `/agenda?date=${appt.starts_at.slice(0, 10)}`
    ),
  ]);

  redirect(`/turno/${id}/cancelar?ok=cancelado`);
}
