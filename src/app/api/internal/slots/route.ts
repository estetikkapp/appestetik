/**
 * GET /api/internal/slots?service_id=<id>&date=<YYYY-MM-DD>&professional_id=<id?>
 *
 * Versión autenticada del endpoint /api/slots — usa la cookie active_org del
 * user logueado. Lo consume el sheet de crear turno en /agenda para mostrar
 * los slots disponibles según el servicio + fecha + profesional elegidos.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
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

function getOffsetSuffix(tz: string): string {
  if (tz === 'America/Argentina/Buenos_Aires') return '-03:00';
  return '-03:00';
}

export async function GET(request: NextRequest) {
  // Autenticación: requiere user con membership activa en la org de la cookie
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .maybeSingle();
  if (!m) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get('service_id');
  const dateStr = searchParams.get('date');
  const professionalIdParam = searchParams.get('professional_id'); // user_id (auth.users)

  if (!serviceId || !dateStr) {
    return NextResponse.json({ error: 'Faltan service_id, date' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Formato de fecha inválido' }, { status: 400 });
  }

  // Reuse admin client para los queries del slot calc (mas eficiente)
  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('id, timezone')
    .eq('id', orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org no encontrada' }, { status: 404 });

  const { data: service } = await admin
    .from('services')
    .select('id, duration_minutes, buffer_minutes')
    .eq('id', serviceId)
    .eq('organization_id', orgId)
    .eq('active', true)
    .maybeSingle();
  if (!service) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 404 });

  const totalMinutes = service.duration_minutes + (service.buffer_minutes ?? 0);

  const { data: profsWithServices } = await admin
    .from('professional_services')
    .select('membership_id, service_id')
    .eq('organization_id', orgId);

  const profsWithExplicitServices = new Set(
    (profsWithServices ?? []).map((p) => p.membership_id)
  );
  const profsOfferingThisService = new Set(
    (profsWithServices ?? [])
      .filter((p) => p.service_id === serviceId)
      .map((p) => p.membership_id)
  );

  const { data: memberships } = await admin
    .from('memberships')
    .select('id, user_id, display_name, role, schedule_template_id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .in('role', ['owner', 'admin', 'professional']);

  const templateIds = (memberships ?? [])
    .map((mm) => mm.schedule_template_id)
    .filter((id): id is string => !!id);
  const { data: templates } = templateIds.length > 0
    ? await admin
        .from('schedule_templates')
        .select('id, attention_windows, slot_minutes, active')
        .in('id', templateIds)
        .eq('organization_id', orgId)
    : { data: [] };
  const templateMap = new Map((templates ?? []).map((t) => [t.id, t]));

  const eligibleProfessionals = (memberships ?? []).filter((mm) => {
    if (profsWithExplicitServices.has(mm.id)) {
      return profsOfferingThisService.has(mm.id);
    }
    return true;
  });

  // Filtrar por user_id (auth.users.id) si vino professional_id
  const targetProfessionals = professionalIdParam
    ? eligibleProfessionals.filter((mm) => mm.user_id === professionalIdParam)
    : eligibleProfessionals;

  if (targetProfessionals.length === 0) {
    return NextResponse.json({
      slots: [],
      reason: 'no_professionals_eligible',
      hint: 'Asignar plantilla de horarios y servicio al profesional desde Empleadas.',
    });
  }

  const dayStart = new Date(`${dateStr}T00:00:00${getOffsetSuffix(org.timezone)}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: appts }, { data: blocks }] = await Promise.all([
    admin
      .from('appointments')
      .select('starts_at, ends_at, professional_id')
      .eq('organization_id', orgId)
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString()),
    admin
      .from('schedule_blocks')
      .select('starts_at, ends_at, professional_id, resource_id, all_day')
      .eq('organization_id', orgId)
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

  const allSlots = new Set<string>();

  for (const mm of targetProfessionals) {
    const tplRel = mm.schedule_template_id ? templateMap.get(mm.schedule_template_id) : null;
    if (!tplRel || !tplRel.active) continue;

    const proAuthId = mm.user_id;
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
    for (const d of available) allSlots.add(d.toISOString());
  }

  const sortedSlots = Array.from(allSlots).sort();

  return NextResponse.json({
    slots: sortedSlots,
    timezone: org.timezone,
    duration_minutes: service.duration_minutes,
  });
}
