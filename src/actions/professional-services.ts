'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/utils/db-errors';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

/**
 * Setea los servicios que ofrece una profesional. Recibe los IDs como
 * múltiples campos `service_ids` del form.
 *
 * Si no se selecciona ningún servicio, se borran todos los registros existentes
 * — convención: profesional sin servicios asignados puede hacer TODOS.
 */
export async function setProfessionalServices(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const membershipId = String(formData.get('membership_id') ?? '');
  if (!membershipId) redirect('/empleadas?error=ID+invalido');

  const serviceIds = formData.getAll('service_ids').map((v) => String(v));

  const supabase = createClient();

  // Borrar los actuales
  await supabase
    .from('professional_services')
    .delete()
    .eq('membership_id', membershipId)
    .eq('organization_id', orgId);

  // Insertar los nuevos
  if (serviceIds.length > 0) {
    const rows = serviceIds.map((serviceId) => ({
      membership_id: membershipId,
      service_id: serviceId,
      organization_id: orgId,
    }));
    const { error } = await supabase.from('professional_services').insert(rows);
    if (error) redirect(`/empleadas?error=${encodeURIComponent(translateDbError(error))}`);
  }

  revalidatePath('/empleadas');
  redirect('/empleadas?ok=servicios-asignados');
}
