/**
 * Helper para escribir al audit_log. Append-only.
 * Best-effort: nunca rompe el flow principal.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface AuditInput {
  organizationId: string;
  action: string; // ej: 'appointment.cancel', 'closure.apply'
  entityType: string; // ej: 'appointment', 'closure'
  entityId?: string | null;
  payload?: Record<string, unknown>;
  actorLabel?: string; // para acciones de sistema/cron sin user
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    let actorUserId: string | null = null;
    if (!input.actorLabel) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      actorUserId = user?.id ?? null;
    }

    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      organization_id: input.organizationId,
      actor_user_id: actorUserId,
      actor_label: input.actorLabel ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      payload: (input.payload ?? {}) as never,
    });
  } catch (err) {
    console.error('[audit] failed:', err);
  }
}
