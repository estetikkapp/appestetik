/**
 * Slot generator TZ-aware adaptado del modelo turnos UTN-FRT.
 *
 * Genera huecos disponibles para una profesional o "cualquiera disponible"
 * en un día específico, considerando:
 * - Plantilla de horarios de la profesional (attention_windows + slot_minutes)
 * - Duración del servicio (en cuántos slots consecutivos cae)
 * - Turnos ya tomados (status pending/confirmed/in_progress)
 * - Schedule blocks (vacaciones, mantenimiento) globales o específicos
 *
 * CRITICO: timezone-aware. Vercel corre en UTC pero el centro está en TZ
 * de Argentina (o configurado en organizations.timezone). Usamos
 * Intl.DateTimeFormat para calcular el offset.
 */

export interface AttentionWindow {
  weekday: number; // 0=Domingo, 6=Sábado
  start_time: string; // 'HH:MM'
  end_time: string;
}

export interface ScheduleTemplate {
  attention_windows: AttentionWindow[];
  slot_minutes: number;
}

export interface BookedSlot {
  starts_at: string; // ISO
  ends_at: string;
  professional_id: string | null;
}

export interface ScheduleBlock {
  starts_at: string;
  ends_at: string;
  professional_id: string | null; // null = aplica a toda la org
  resource_id: string | null;
  all_day: boolean;
}

export interface ProfessionalSlots {
  professional_id: string;
  display_name: string | null;
  available_slots: string[]; // ISO timestamps
}

/**
 * Convierte una fecha local "YYYY-MM-DD HH:MM" en TZ dada → ISO UTC.
 * Necesario porque el server corre en UTC pero los horarios de la
 * plantilla están expresados en hora local del centro.
 */
function localToUtc(dateStr: string, timeStr: string, tz: string): Date {
  // Construye un instant que represente "esta fecha a esta hora en esta TZ".
  // Truco: pedimos la representación de un Date en la TZ y comparamos contra UTC.
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Creamos un Date asumiendo UTC, después calculamos el offset de la TZ ese día
  const naiveUtc = Date.UTC(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    0
  );

  // Offset entre la hora "real" en la TZ y la hora UTC para ese instante
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(naiveUtc));
  const tzYear = Number(parts.find((p) => p.type === 'year')?.value);
  const tzMonth = Number(parts.find((p) => p.type === 'month')?.value);
  const tzDay = Number(parts.find((p) => p.type === 'day')?.value);
  const tzHour = Number(parts.find((p) => p.type === 'hour')?.value);
  const tzMinute = Number(parts.find((p) => p.type === 'minute')?.value);

  const tzAsUtcMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour % 24, tzMinute, 0);
  // diff = (UTC al naive) - (UTC equiv en la TZ) = offset
  const offsetMs = naiveUtc - tzAsUtcMs;

  return new Date(naiveUtc + offsetMs);
}

/**
 * Devuelve el día de la semana (0=Dom..6=Sáb) de una fecha YYYY-MM-DD
 * interpretándola en la TZ dada.
 */
function weekdayInTz(dateStr: string, tz: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Mediodía evita drama de DST en bordes
  const utcMidday = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const wkShort = fmt.format(utcMidday);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wkShort] ?? 0;
}

/**
 * Genera todos los slot start times (ISO UTC) para una plantilla en un día.
 * No filtra por reservas ni cierres — eso lo hace el caller.
 */
export function generateBaseSlots(
  template: ScheduleTemplate,
  dateStr: string, // 'YYYY-MM-DD'
  tz: string
): Date[] {
  const wd = weekdayInTz(dateStr, tz);
  const windows = template.attention_windows.filter((w) => w.weekday === wd);
  if (windows.length === 0) return [];

  const slots: Date[] = [];
  for (const win of windows) {
    const startUtc = localToUtc(dateStr, win.start_time, tz);
    const endUtc = localToUtc(dateStr, win.end_time, tz);

    let cursor = startUtc.getTime();
    const stepMs = template.slot_minutes * 60 * 1000;
    while (cursor + stepMs <= endUtc.getTime()) {
      slots.push(new Date(cursor));
      cursor += stepMs;
    }
  }
  return slots;
}

/**
 * Filtra slots removiendo los que se solapan con appointments existentes
 * o con schedule blocks. Considera la duración del servicio.
 *
 * @param baseSlots slots inicio candidatos
 * @param serviceDurationMinutes duración del servicio + buffer (en minutos)
 * @param professionalId profesional para quien se calcula (null = cualquiera)
 * @param bookedSlots turnos activos
 * @param blocks bloqueos de schedule
 */
export function filterAvailableSlots(
  baseSlots: Date[],
  serviceDurationMinutes: number,
  professionalId: string | null,
  bookedSlots: BookedSlot[],
  blocks: ScheduleBlock[],
  nowMs: number = Date.now()
): Date[] {
  const durMs = serviceDurationMinutes * 60 * 1000;

  return baseSlots.filter((slot) => {
    const slotStart = slot.getTime();
    const slotEnd = slotStart + durMs;

    // 1. No permitir slots en el pasado
    if (slotStart < nowMs) return false;

    // 2. No solaparse con appointments del mismo profesional (si está definido)
    for (const b of bookedSlots) {
      if (professionalId && b.professional_id !== professionalId) continue;
      const bStart = new Date(b.starts_at).getTime();
      const bEnd = new Date(b.ends_at).getTime();
      if (slotStart < bEnd && slotEnd > bStart) return false;
    }

    // 3. No solaparse con schedule_blocks aplicables
    for (const blk of blocks) {
      // Aplica si: (a) es global (no tiene professional_id ni resource_id),
      // o (b) es del mismo professional_id
      const appliesToOrg = !blk.professional_id && !blk.resource_id;
      const appliesToPro = !!(
        professionalId && blk.professional_id === professionalId
      );
      if (!appliesToOrg && !appliesToPro) continue;

      const bStart = new Date(blk.starts_at).getTime();
      const bEnd = new Date(blk.ends_at).getTime();
      if (slotStart < bEnd && slotEnd > bStart) return false;
    }

    return true;
  });
}
