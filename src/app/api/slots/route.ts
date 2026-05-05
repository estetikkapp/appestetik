/**
 * GET /api/slots?slug=<orgSlug>&service_id=<id>&date=<YYYY-MM-DD>&professional_id=<id?>
 *
 * Endpoint público que devuelve slots disponibles para una organización
 * (identificada por slug) + servicio + día. Si se pasa professional_id,
 * filtra por esa profesional; sino devuelve los disponibles agrupados
 * por profesional ("cualquiera disponible").
 *
 * Usa admin client (no requiere auth — es público para que la página
 * /c/[slug] pueda consumirlo).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateBaseSlots,
  filterAvailableSlots,
  type AttentionWindow,
  type ScheduleTemplate,
  type BookedSlot,
  type ScheduleBlock,
} from '@/lib/utils/slots';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const serviceId = searchParams.get('service_id');
  const dateStr = searchParams.get('date');
  const professionalIdParam = searchParams.get('professional_id');

  if (!slug || !serviceId || !dateStr) {
    return NextResponse.json(
      { error: 'Faltan parametros: slug, service_id, date' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Formato de fecha inválido' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolver org por slug
  const { data: org } = await supabase
    .from('organizations')
    .select('id, timezone')
    .eq('slug', slug)
    .not('onboarded_at', 'is', null)
    .maybeSingle();

  if (!org) return NextResponse.json({ error: 'Centro no encontrado' }, { status: 404 });

  // Servicio + duración + buffer
  const { data: service } = await supabase
    .from('services')
    .select('id, duration_minutes, buffer_minutes')
    .eq('id', serviceId)
    .eq('organization_id', org.id)
    .eq('active', true)
    .maybeSingle();

  if (!service) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 404 });

  const totalMinutes = service.duration_minutes + (service.buffer_minutes ?? 0);

  // Profesionales que ofrecen este servicio
  // Si una profesional tiene professional_services rows → solo ofrece esos
  // Si no tiene rows → ofrece todos (convención).
  const { data: profsWithServices } = await supabase
    .from('professional_services')
    .select('membership_id, service_id')
    .eq('organization_id', org.id);

  const profsWithExplicitServices = new Set(
    (profsWithServices ?? []).map((p) => p.membership_id)
  );
  const profsOfferingThisService = new Set(
    (profsWithServices ?? [])
      .filter((p) => p.service_id === serviceId)
      .map((p) => p.membership_id)
  );

  // Memberships activos de profesionales (owner/admin/professional)
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, user_id, display_name, role, schedule_template_id')
    .eq('organization_id', org.id)
    .eq('active', true)
    .in('role', ['owner', 'admin', 'professional']);

  // Fetch templates por separado
  const templateIds = (memberships ?? [])
    .map((m) => m.schedule_template_id)
    .filter((id): id is string => !!id);
  const { data: templates } = templateIds.length > 0
    ? await supabase
        .from('schedule_templates')
        .select('id, attention_windows, slot_minutes, active')
        .in('id', templateIds)
        .eq('organization_id', org.id)
    : { data: [] };
  const templateMap = new Map(
    (templates ?? []).map((t) => [t.id, t])
  );

  const eligibleProfessionals = (memberships ?? []).filter((m) => {
    // Si tiene servicios explícitos, solo si incluye este
    if (profsWithExplicitServices.has(m.id)) {
      return profsOfferingThisService.has(m.id);
    }
    // Sin restricciones: puede hacer todos
    return true;
  });

  // Si filtramos por professional_id (membership_id), restringir
  const targetProfessionals = professionalIdParam
    ? eligibleProfessionals.filter((m) => m.id === professionalIdParam)
    : eligibleProfessionals;

  if (targetProfessionals.length === 0) {
    return NextResponse.json({
      slots: [],
      professionals: [],
      reason: 'no_professionals_eligible',
    });
  }

  // Fetch appointments y blocks del día
  const dayStart = new Date(`${dateStr}T00:00:00${getOffsetSuffix(org.timezone)}`);
  const dayEnd = new Date(dayStart.getTime() + 26 * 60 * 60 * 1000); // +26h por DST

  const [{ data: appts }, { data: blocks }] = await Promise.all([
    supabase
      .from('appointments')
      .select('starts_at, ends_at, professional_id')
      .eq('organization_id', org.id)
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString()),
    supabase
      .from('schedule_blocks')
      .select('starts_at, ends_at, professional_id, resource_id, all_day')
      .eq('organization_id', org.id)
      .lt('starts_at', dayEnd.toISOString())
      .gt('ends_at', dayStart.toISOString()),
  ]);

  const bookedSlots: BookedSlot[] = (appts ?? []).map((a) => ({
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    professional_id: a.professional_id,
  }));

  const allBlocks: ScheduleBlock[] = (blocks ?? []).map((b) => ({
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    professional_id: b.professional_id,
    resource_id: b.resource_id,
    all_day: b.all_day,
  }));

  // Para cada profesional, generar y filtrar slots
  const result: Array<{
    professional_id: string;
    display_name: string | null;
    slots: string[];
  }> = [];

  for (const m of targetProfessionals) {
    const tplRel = m.schedule_template_id ? templateMap.get(m.schedule_template_id) : null;
    if (!tplRel || !tplRel.active) continue;

    // Use the user_id (auth.users.id) as professional_id since appointments.professional_id
    // refers to auth.users (not memberships)
    const proAuthId = m.user_id;

    const template: ScheduleTemplate = {
      attention_windows: tplRel.attention_windows as unknown as AttentionWindow[],
      slot_minutes: tplRel.slot_minutes,
    };

    const baseSlots = generateBaseSlots(template, dateStr, org.timezone);
    const available = filterAvailableSlots(
      baseSlots,
      totalMinutes,
      proAuthId,
      bookedSlots,
      allBlocks
    );

    if (available.length > 0) {
      result.push({
        professional_id: m.id, // membership id (lo que la UI usa para el form)
        display_name: m.display_name,
        slots: available.map((d) => d.toISOString()),
      });
    }
  }

  // Si pidieron "cualquiera", también devolvemos un agregado: union de slots únicos
  const aggregateSlots = professionalIdParam
    ? null
    : Array.from(new Set(result.flatMap((r) => r.slots))).sort();

  return NextResponse.json({
    professionals: result,
    aggregate_slots: aggregateSlots,
    slot_minutes: targetProfessionals[0]?.schedule_template_id
      ? templateMap.get(targetProfessionals[0].schedule_template_id)?.slot_minutes ?? 30
      : 30,
  });
}

/**
 * Helper para construir un offset suffix tipo "-03:00" para Argentina.
 * No es perfecto (no maneja DST automaticamente para todos los TZs) pero
 * Argentina no tiene DST desde 2009, asi que -03:00 fijo es correcto.
 */
function getOffsetSuffix(tz: string): string {
  if (tz === 'America/Argentina/Buenos_Aires') return '-03:00';
  // Fallback: parsear offset actual de la TZ
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  const part = fmt.formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
  const match = part?.value.match(/GMT([+-]\d{1,2})/);
  if (match) {
    const hours = match[1]!;
    return `${hours.length === 2 ? hours[0] + '0' + hours[1] : hours}:00`;
  }
  return '-03:00';
}
