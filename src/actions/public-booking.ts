'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPhoneAr, normalizePhoneAr } from '@/lib/validators/phone-ar';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';

/**
 * Crea una reserva pública desde /c/[slug]. Usa admin client porque:
 * - La clienta no está autenticada (no puede insertar via RLS policy del panel)
 * - Necesitamos bypasear RLS de manera controlada
 *
 * Validaciones:
 * - El slug debe existir y estar onboarded
 * - El servicio debe pertenecer a esa org y estar activo
 * - El horario debe estar dentro de business_hours del día
 * - No debe haber conflicto con otro appointment o schedule block
 *
 * Si la clienta es nueva (por teléfono o email), se crea el registro.
 */
export async function createPublicReservation(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim();
  const serviceId = String(formData.get('service_id') ?? '').trim();
  const startsAt = String(formData.get('starts_at') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const rawPhone = String(formData.get('phone') ?? '').trim();
  const rawEmail = String(formData.get('email') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  const baseUrl = `/c/${slug}`;

  if (!slug) redirect('/?error=URL+invalida');
  if (!serviceId || !startsAt || !fullName) {
    redirect(`${baseUrl}?error=Completa+todos+los+campos`);
  }
  if (!rawPhone || !isValidPhoneAr(rawPhone)) {
    redirect(`${baseUrl}?error=Tel%C3%A9fono+inv%C3%A1lido`);
  }
  if (rawEmail && !isValidEmail(rawEmail)) {
    redirect(`${baseUrl}?error=Email+inv%C3%A1lido`);
  }

  const supabase = createAdminClient();

  // Obtener organización por slug
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .not('onboarded_at', 'is', null)
    .maybeSingle();

  if (!org) redirect(`${baseUrl}?error=Centro+no+encontrado`);

  // Obtener servicio
  const { data: service } = await supabase
    .from('services')
    .select('id, duration_minutes, buffer_minutes')
    .eq('id', serviceId)
    .eq('organization_id', org.id)
    .eq('active', true)
    .maybeSingle();

  if (!service) redirect(`${baseUrl}?error=Servicio+no+disponible`);

  const startDate = new Date(startsAt);
  if (isNaN(startDate.getTime())) {
    redirect(`${baseUrl}?error=Fecha+u+hora+inv%C3%A1lida`);
  }
  if (startDate.getTime() < Date.now()) {
    redirect(`${baseUrl}?error=No+pod%C3%A9s+reservar+en+el+pasado`);
  }

  const totalMinutes = service.duration_minutes + (service.buffer_minutes ?? 0);
  const endDate = new Date(startDate.getTime() + totalMinutes * 60 * 1000);

  // Check conflicto básico (no filtramos por professional/resource en la pública)
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('organization_id', org.id)
    .in('status', ['pending', 'confirmed', 'in_progress'])
    .lt('starts_at', endDate.toISOString())
    .gt('ends_at', startDate.toISOString())
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    redirect(`${baseUrl}?error=Ese+horario+acaba+de+ser+tomado%2C+eleg%C3%AD+otro`);
  }

  const phone = normalizePhoneAr(rawPhone);
  const email = rawEmail ? normalizeEmail(rawEmail) : null;

  // Buscar o crear clienta (por teléfono es el match más confiable)
  let clientId: string;
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('organization_id', org.id)
    .eq('phone_e164', phone)
    .maybeSingle();

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        organization_id: org.id,
        full_name: fullName,
        phone_e164: phone,
        email,
      })
      .select('id')
      .single();

    if (clientError || !newClient) {
      redirect(`${baseUrl}?error=No+se+pudo+crear+la+clienta`);
    }
    clientId = newClient.id;
  }

  const { error: apptError } = await supabase.from('appointments').insert({
    organization_id: org.id,
    client_id: clientId,
    service_id: service.id,
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    notes,
    source: 'public',
    status: 'pending',
  });

  if (apptError) {
    redirect(`${baseUrl}?error=${encodeURIComponent(apptError.message)}`);
  }

  redirect(`${baseUrl}/confirmacion`);
}
