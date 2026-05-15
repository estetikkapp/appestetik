'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPhoneAr, normalizePhoneAr } from '@/lib/validators/phone-ar';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';
import { isValidDni, normalizeDni } from '@/lib/validators/dni';
import { sendWhatsappMessage } from '@/lib/integrations/whatsapp';
import { sendEmail } from '@/lib/integrations/email/resend';
import { bookingConfirmationEmail } from '@/lib/integrations/email/templates';
import { notifyOrgAdmins } from '@/lib/notifications';
import { audit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

function generateSecurityCode(): string {
  // 6 dígitos numéricos
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Crea reserva pública. Usa admin client (clienta no autenticada).
 *
 * Validaciones:
 * - Org existe y onboarded
 * - Servicio activo
 * - Profesional (si se eligió) está activo y tiene plantilla
 * - Slot no conflicta con turnos existentes ni schedule_blocks
 *
 * Genera security_code de 6 dígitos, guarda hash, manda por WhatsApp si la
 * org tiene WhatsApp conectado.
 */
export async function createPublicReservation(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim();
  const serviceId = String(formData.get('service_id') ?? '').trim();
  const startsAt = String(formData.get('starts_at') ?? '').trim();
  const professionalMembershipId = String(formData.get('professional_id') ?? '').trim() || null;
  const fullName = String(formData.get('full_name') ?? '').trim();
  const rawPhone = String(formData.get('phone') ?? '').trim();
  const rawEmail = String(formData.get('email') ?? '').trim();
  const rawDni = String(formData.get('dni') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const isEmbed = String(formData.get('embed') ?? '') === '1';

  const baseUrl = isEmbed ? `/embed/${slug}` : `/c/${slug}`;

  if (!slug) redirect('/?error=URL+invalida');

  // Rate limit por IP: max 5 intentos en 10min. Frena spam/scripts pero
  // permite retries legitimos si hay error de validacion + reintento.
  const rl = await checkRateLimit('public_booking', 5, 10);
  if (!rl.ok) {
    redirect(
      `${baseUrl}?error=Demasiadas+reservas+desde+esta+IP.+Esper%C3%A1+${rl.retryAfterMinutes}+min.`
    );
  }

  // Validaciones — todos los campos del form son obligatorios (notes opcional).
  if (!serviceId || !startsAt) {
    redirect(`${baseUrl}?error=Faltan+datos+del+turno`);
  }
  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    redirect(`${baseUrl}?error=Nombre+inv%C3%A1lido+%282-100+caracteres%29`);
  }
  if (!rawPhone || !isValidPhoneAr(rawPhone)) {
    redirect(`${baseUrl}?error=Tel%C3%A9fono+inv%C3%A1lido`);
  }
  if (!rawEmail || !isValidEmail(rawEmail)) {
    redirect(`${baseUrl}?error=Email+inv%C3%A1lido+o+vac%C3%ADo`);
  }
  if (!rawDni || !isValidDni(rawDni)) {
    redirect(`${baseUrl}?error=DNI+inv%C3%A1lido+%287%20u%208%20d%C3%ADgitos%29`);
  }
  if (notes && notes.length > 500) {
    redirect(`${baseUrl}?error=Comentario+demasiado+largo+%28m%C3%A1x+500%29`);
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
    .select('id, name, duration_minutes, buffer_minutes')
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
    redirect(`${baseUrl}?error=No+se+puede+reservar+en+el+pasado`);
  }

  const totalMinutes = service.duration_minutes + (service.buffer_minutes ?? 0);
  const endDate = new Date(startDate.getTime() + totalMinutes * 60 * 1000);

  // Resolver auth user_id del profesional desde membership.
  // CRITICO: validar que pertenece a la org (impide enumerar membership_ids
  // entre orgs vía URL). El .eq('organization_id', org.id) es la línea que protege.
  let professionalAuthUserId: string | null = null;
  if (professionalMembershipId) {
    const { data: m } = await supabase
      .from('memberships')
      .select('user_id, schedule_template_id')
      .eq('id', professionalMembershipId)
      .eq('organization_id', org.id)
      .eq('active', true)
      .maybeSingle();
    if (!m) redirect(`${baseUrl}?error=Profesional+no+disponible`);
    if (!m.schedule_template_id) {
      redirect(`${baseUrl}?error=Esa+profesional+no+tiene+horarios+configurados`);
    }
    professionalAuthUserId = m.user_id;
  }

  // Conflict check (mismo profesional o "cualquiera": ningún slot ocupado de cualquier pro)
  let conflictQuery = supabase
    .from('appointments')
    .select('id')
    .eq('organization_id', org.id)
    .in('status', ['pending', 'confirmed', 'in_progress'])
    .lt('starts_at', endDate.toISOString())
    .gt('ends_at', startDate.toISOString());
  if (professionalAuthUserId) {
    conflictQuery = conflictQuery.eq('professional_id', professionalAuthUserId);
  }
  const { data: conflicts } = await conflictQuery.limit(1);
  if (conflicts && conflicts.length > 0) {
    redirect(`${baseUrl}?error=Ese+horario+acaba+de+ser+tomado%2C+eleg%C3%AD+otro`);
  }

  const phone = normalizePhoneAr(rawPhone);
  const email = normalizeEmail(rawEmail);
  const dni = normalizeDni(rawDni);

  // Match de clienta — DNI es la fuente de verdad porque es identificador
  // unico no transferible. Reglas:
  //   1. Si hay clienta con MISMO dni -> es ella. (backfill phone/email
  //      si estaban null en DB).
  //   2. Si NO hay match por dni:
  //      a. Si hay clienta con MISMO phone PERO con dni null -> es ella
  //         (clienta vieja que nunca cargo dni). Backfill dni.
  //      b. Si hay clienta con MISMO phone Y dni distinto -> es OTRA
  //         persona compartiendo telefono (ej. madre/hijo). CREAR NUEVA.
  //      c. Si no hay match por phone -> CREAR NUEVA.
  let clientId: string;
  let matched: { id: string; phone_e164: string | null; email: string | null; dni: string | null } | null = null;
  let backfillReason: 'by_dni' | 'phone_no_dni' | null = null;

  // 1. Match por DNI
  const { data: byDni } = await supabase
    .from('clients')
    .select('id, phone_e164, email, dni')
    .eq('organization_id', org.id)
    .eq('dni', dni)
    .maybeSingle();

  if (byDni) {
    matched = byDni;
    backfillReason = 'by_dni';
  } else {
    // 2. No match por DNI -> chequear phone, pero solo si esa clienta NO
    //    tiene un dni distinto cargado (sino es otra persona).
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id, phone_e164, email, dni')
      .eq('organization_id', org.id)
      .eq('phone_e164', phone)
      .maybeSingle();
    if (byPhone && byPhone.dni === null) {
      matched = byPhone;
      backfillReason = 'phone_no_dni';
    }
    // Si byPhone existe pero tiene dni distinto -> NO matcheamos. Crear nueva.
  }

  if (matched) {
    clientId = matched.id;
    // Backfill: solo escribimos los campos que estaban null en DB.
    // No sobreescribimos data existente (preserva lo que cargo el staff).
    const updates: Array<keyof typeof matched> = [];
    if (!matched.phone_e164) updates.push('phone_e164');
    if (!matched.email) updates.push('email');
    if (!matched.dni) updates.push('dni');
    if (updates.length > 0) {
      await supabase
        .from('clients')
        .update({
          ...(!matched.phone_e164 ? { phone_e164: phone } : {}),
          ...(!matched.email ? { email } : {}),
          ...(!matched.dni ? { dni } : {}),
        })
        .eq('id', matched.id);
    }
    void backfillReason; // solo para documentacion / debug
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        organization_id: org.id,
        full_name: fullName,
        phone_e164: phone,
        email,
        dni,
      })
      .select('id')
      .single();
    if (clientError || !newClient) {
      redirect(`${baseUrl}?error=No+se+pudo+crear+la+clienta`);
    }
    clientId = newClient.id;
  }

  // Generar security code de 6 dígitos
  const securityCode = generateSecurityCode();
  const securityHash = await bcrypt.hash(securityCode, 10);

  // Crear appointment
  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .insert({
      organization_id: org.id,
      client_id: clientId,
      service_id: service.id,
      professional_id: professionalAuthUserId,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      notes,
      source: 'public',
      status: 'pending',
      security_code_hash: securityHash,
    })
    .select('id')
    .single();

  if (apptError || !appt) {
    redirect(`${baseUrl}?error=${encodeURIComponent(apptError?.message ?? 'No se pudo crear el turno')}`);
  }

  // Mandar code por WhatsApp si la org tiene conexión activa (best-effort, no bloquea)
  const fechaTexto = startDate.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com'}/turno/${appt.id}/cancelar`;

  if (org.whatsapp_status === 'connected') {
    const message = `Hola ${fullName} 👋

Tu turno en *${org.name}* fue reservado para el ${fechaTexto} para *${service.name}*.

Está pendiente de confirmación por el centro.

🔑 Tu código para cancelar/reagendar es: *${securityCode}*
🔗 ${cancelUrl}

Por favor no compartas este código.`;

    try {
      await sendWhatsappMessage(org.id, phone, message);
    } catch (err) {
      console.error('[public-booking] WhatsApp send error:', err);
      // best-effort, sigue
    }
  }

  // Si dejó email, mandar confirmación por mail (best-effort)
  if (email) {
    const tpl = bookingConfirmationEmail({
      clientName: fullName,
      orgName: org.name,
      serviceName: service.name,
      startsAtFormatted: fechaTexto,
      cancelUrl,
      securityCode,
    });
    try {
      await sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tags: [
          { name: 'type', value: 'booking_confirmation' },
          { name: 'org_id', value: org.id },
        ],
      });
    } catch (err) {
      console.error('[public-booking] email send error:', err);
    }
  }

  // Audit + notif al panel
  await Promise.all([
    audit({
      organizationId: org.id,
      action: 'appointment.create.public',
      entityType: 'appointment',
      entityId: appt.id,
      payload: { client_name: fullName, service: service.name },
      actorLabel: 'clienta',
    }),
    notifyOrgAdmins(
      org.id,
      'appointment_created_public',
      `Reserva nueva: ${fullName}`,
      `${service.name} · ${startDate.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      `/agenda?date=${startDate.toISOString().slice(0, 10)}`
    ),
  ]);

  redirect(`${baseUrl}/confirmacion?turno=${appt.id}`);
}
