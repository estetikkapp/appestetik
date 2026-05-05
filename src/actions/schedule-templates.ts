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

export interface AttentionWindow {
  weekday: number; // 0-6 (0=Domingo)
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
}

function parseWindowsFromForm(formData: FormData): AttentionWindow[] {
  const windows: AttentionWindow[] = [];
  for (let day = 0; day <= 6; day++) {
    if (formData.get(`active_${day}`) !== 'on') continue;
    const start = String(formData.get(`start_${day}`) ?? '').trim();
    const end = String(formData.get(`end_${day}`) ?? '').trim();
    if (!start || !end) continue;
    if (start >= end) continue;
    windows.push({ weekday: day, start_time: start, end_time: end });
  }
  return windows;
}

export async function createScheduleTemplate(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const name = String(formData.get('name') ?? '').trim();
  const slotMinutes = Number(formData.get('slot_minutes') ?? 30);
  const isDefault = formData.get('is_default') === 'on';
  const windows = parseWindowsFromForm(formData);

  if (!name) redirect('/horarios?error=Nombre+requerido');
  if (windows.length === 0) redirect('/horarios?error=Configura+al+menos+un+d%C3%ADa');
  if (slotMinutes < 5 || slotMinutes > 240) {
    redirect('/horarios?error=Granularidad+inv%C3%A1lida');
  }

  const supabase = createClient();

  // Si esta plantilla es default, deshabilitar default en otras
  if (isDefault) {
    await supabase
      .from('schedule_templates')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('is_default', true);
  }

  const { error } = await supabase.from('schedule_templates').insert({
    organization_id: orgId,
    name,
    attention_windows: windows as unknown as never, // Json
    slot_minutes: slotMinutes,
    is_default: isDefault,
  });

  if (error) redirect(`/horarios?error=${encodeURIComponent(translateDbError(error))}`);
  revalidatePath('/horarios');
  redirect('/horarios?ok=plantilla-creada');
}

export async function updateScheduleTemplate(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/horarios?error=ID+invalido');

  const name = String(formData.get('name') ?? '').trim();
  const slotMinutes = Number(formData.get('slot_minutes') ?? 30);
  const isDefault = formData.get('is_default') === 'on';
  const windows = parseWindowsFromForm(formData);

  if (!name) redirect('/horarios?error=Nombre+requerido');
  if (windows.length === 0) redirect('/horarios?error=Configura+al+menos+un+d%C3%ADa');

  const supabase = createClient();

  if (isDefault) {
    await supabase
      .from('schedule_templates')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .neq('id', id);
  }

  const { error } = await supabase
    .from('schedule_templates')
    .update({
      name,
      attention_windows: windows as unknown as never,
      slot_minutes: slotMinutes,
      is_default: isDefault,
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/horarios?error=${encodeURIComponent(translateDbError(error))}`);
  revalidatePath('/horarios');
  redirect('/horarios?ok=actualizada');
}

export async function toggleScheduleTemplateActive(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const supabase = createClient();
  const { error } = await supabase
    .from('schedule_templates')
    .update({ active: !active })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/horarios?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/horarios');
  redirect('/horarios');
}

export async function deleteScheduleTemplate(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/horarios?error=ID+invalido');

  const supabase = createClient();
  // Antes de borrar, desasignar memberships que la tienen
  await supabase
    .from('memberships')
    .update({ schedule_template_id: null })
    .eq('organization_id', orgId)
    .eq('schedule_template_id', id);

  const { error } = await supabase
    .from('schedule_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/horarios?error=${encodeURIComponent(translateDbError(error))}`);
  revalidatePath('/horarios');
  redirect('/horarios?ok=eliminada');
}

export async function assignTemplateToMembership(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const membershipId = String(formData.get('membership_id') ?? '');
  const templateId = String(formData.get('schedule_template_id') ?? '') || null;
  if (!membershipId) redirect('/empleadas?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('memberships')
    .update({ schedule_template_id: templateId })
    .eq('id', membershipId)
    .eq('organization_id', orgId);

  if (error) redirect(`/empleadas?error=${encodeURIComponent(translateDbError(error))}`);
  revalidatePath('/empleadas');
  redirect('/empleadas?ok=plantilla-asignada');
}
