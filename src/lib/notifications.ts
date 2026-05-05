/**
 * Helper para crear notificaciones in-app.
 * Adaptado del patrón UTN-FRT.
 *
 * Las notifs son por user_id (auth.users.id), no por membership.
 * Si querés notificar a "todos los owners de la org X", primero hacés
 * la query a memberships y después llamás createNotification por cada uno.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface NotificationInput {
  organizationId: string;
  userId: string; // auth.users.id
  type: string; // ej: 'appointment_cancelled', 'closure_applied'
  title: string;
  body?: string | null;
  link?: string | null;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('notifications').insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  } catch (err) {
    // Best-effort: notifs no deben bloquear el flow principal
    console.error('[notifications] createNotification failed:', err);
  }
}

/**
 * Notifica a todos los owners + admins de una organización.
 * Útil para eventos del sistema (turno reservado public, cancelado por clienta, etc.)
 */
export async function notifyOrgAdmins(
  organizationId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: admins } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .in('role', ['owner', 'admin']);

    if (!admins || admins.length === 0) return;

    const rows = admins.map((m) => ({
      organization_id: organizationId,
      user_id: m.user_id,
      type,
      title,
      body: body ?? null,
      link: link ?? null,
    }));

    await supabase.from('notifications').insert(rows);
  } catch (err) {
    console.error('[notifications] notifyOrgAdmins failed:', err);
  }
}
