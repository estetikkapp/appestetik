'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPhoneAr, normalizePhoneAr } from '@/lib/validators/phone-ar';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';
import { sendWhatsappMessage } from '@/lib/integrations/whatsapp';
import { notifyOrgAdmins } from '@/lib/notifications';
import { audit } from '@/lib/audit';

/**
 * Agregar a la lista de espera desde el flujo público (cliente sin login).
 * Se invoca cuando no hay slots disponibles.
 *
 * - Resuelve org por slug
 * - Crea o reusa cliente por phone_e164
 * - Crea waitlist_entries
 * - Best-effort: WhatsApp confirmando + notif al panel
 */
export async function addToWaitlistPublic(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim();
  const serviceId = String(formData.get('service_id') ?? '').trim();
  const preferredDate = String(formData.get('preferred_date') ?? '').trim() || null;
  const fullName = String(formData.get('full_name') ?? '').trim();
  const rawPhone = String(formData.get('phone') ?? '').trim();
  const rawEmail = String(formData.get('email') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const isEmbed = String(formData.get('embed') ?? '') === '1';

  const baseUrl = isEmbed ? `/embed/${slug}` : `/c/${slug}`;
  if (!slug) redirect('/?error=URL+invalida');
  if (!serviceId || !fullName) {
    redirect(`${baseUrl}?service=${serviceId}&error=Completa+todos+los+campos`);
  }
  if (!rawPhone || !isValidPhoneAr(rawPhone)) {
    redirect(`${baseUrl}?service=${serviceId}&error=Tel%C3%A9fono+inv%C3%A1lido`);
  }
  if (rawEmail && !isValidEmail(rawEmail)) {
    redirect(`${baseUrl}?service=${serviceId}&error=Email+inv%C3%A1lido`);
  }

  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, whatsapp_status')
    .eq('slug', slug)
    .not('onboarded_at', 'is', null)
    .maybeSingle();
  if (!org) redirect(`${baseUrl}?error=Centro+no+encontrado`);

  const { data: service } = await supabase
    .from('services')
    .select('id, name')
    .eq('id', serviceId)
    .eq('organization_id', org.id)
    .eq('active', true)
    .maybeSingle();
  if (!service) redirect(`${baseUrl}?error=Servicio+no+disponible`);

  const phone = normalizePhoneAr(rawPhone);
  const email = rawEmail ? normalizeEmail(rawEmail) : null;

  // Buscar/crear clienta
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
      .insert({ organization_id: org.id, full_name: fullName, phone_e164: phone, email })
      .select('id')
      .single();
    if (clientError || !newClient) {
      redirect(`${baseUrl}?service=${serviceId}&error=No+se+pudo+registrar`);
    }
    clientId = newClient.id;
  }

  // Crear waitlist entry
  const { data: entry, error: insertError } = await supabase
    .from('waitlist_entries')
    .insert({
      organization_id: org.id,
      client_id: clientId,
      service_id: service.id,
      preferred_date: preferredDate,
      notes,
    })
    .select('id')
    .single();

  if (insertError || !entry) {
    redirect(`${baseUrl}?service=${serviceId}&error=No+se+pudo+agregar+a+la+lista`);
  }

  // WhatsApp confirmación (best-effort)
  if (org.whatsapp_status === 'connected') {
    const message = `Hola ${fullName} 👋

Te agregamos a la lista de espera de *${org.name}* para *${service.name}*.

Te vamos a avisar por acá si se libera un turno. ¡Gracias por la paciencia!`;
    try {
      await sendWhatsappMessage(org.id, phone, message);
    } catch (err) {
      console.error('[public-waitlist] WhatsApp send error:', err);
    }
  }

  // Notif + audit
  await Promise.all([
    audit({
      organizationId: org.id,
      action: 'waitlist.add.public',
      entityType: 'waitlist',
      entityId: entry.id,
      payload: { client_name: fullName, service: service.name, preferred_date: preferredDate },
      actorLabel: 'clienta',
    }),
    notifyOrgAdmins(
      org.id,
      'waitlist_added_public',
      `Lista de espera: ${fullName}`,
      `${service.name}${preferredDate ? ` · prefiere ${preferredDate}` : ''}`,
      '/espera'
    ),
  ]);

  redirect(`${baseUrl}?service=${serviceId}&waitlisted=1`);
}
