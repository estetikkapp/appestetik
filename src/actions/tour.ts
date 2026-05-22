'use server';

/**
 * Server actions del welcome tour.
 *
 *   markTourCompletedAction → al finalizar o saltar el tour.
 *                              Setea memberships.tour_completed_at = now()
 *                              para que no vuelva a disparar.
 *
 *   resetTourAction         → botón "Ver tour de nuevo" en /configuracion.
 *                              Vuelve tour_completed_at a NULL y redirige
 *                              al dashboard donde se monta el componente.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireMembership } from '@/lib/auth/require-membership';
import { createAdminClient } from '@/lib/supabase/admin';

export async function markTourCompletedAction(): Promise<void> {
  const { userId, orgId } = await requireMembership();
  const admin = createAdminClient();
  await admin
    .from('memberships')
    .update({ tour_completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('organization_id', orgId);
}

export async function resetTourAction(): Promise<void> {
  const { userId, orgId } = await requireMembership();
  const admin = createAdminClient();
  await admin
    .from('memberships')
    .update({ tour_completed_at: null })
    .eq('user_id', userId)
    .eq('organization_id', orgId);

  revalidatePath('/');
  // Llevamos al user al dashboard que es donde el tour se dispara
  redirect('/?tour=restart');
}
