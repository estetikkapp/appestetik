'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { analyzeSkin } from '@/lib/integrations/claude/skin-analysis';
import { generateProtocol } from '@/lib/integrations/claude/protocol-generator';
import { translateDbError } from '@/lib/utils/db-errors';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

export async function runSkinAnalysis(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const clientAge = Number(formData.get('client_age') ?? 0) || undefined;
  const objective = String(formData.get('objective') ?? '').trim() || undefined;
  const photoFile = formData.get('photo');

  if (!clientId) redirect('/ia?error=Falta+clienta');
  if (!photoFile || !(photoFile instanceof File) || photoFile.size === 0) {
    redirect('/ia?error=Subi+una+foto');
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(photoFile.type)) {
    redirect('/ia?error=Formato+no+soportado');
  }

  const supabase = createClient();

  // Subir foto al bucket skin-analyses
  const ext = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${orgId}/${clientId}/${Date.now()}.${ext}`;
  const buf = await photoFile.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from('skin-analyses')
    .upload(path, new Uint8Array(buf), { contentType: photoFile.type });
  if (upErr) redirect(`/ia?error=${encodeURIComponent(upErr.message)}`);

  const { data: signed } = await supabase.storage
    .from('skin-analyses')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  const photoUrl = signed?.signedUrl ?? '';

  // Catálogo de servicios para que la IA recomiende
  const { data: services } = await supabase
    .from('services')
    .select('id, name, category')
    .eq('organization_id', orgId)
    .eq('active', true);

  // Llamar a Claude
  const base64 = Buffer.from(buf).toString('base64');
  const result = await analyzeSkin({
    imageBase64: base64,
    mimeType: photoFile.type as 'image/png' | 'image/jpeg' | 'image/webp',
    clientAge,
    clientObjective: objective,
    servicesAvailable: services ?? [],
  });

  if (!result) {
    redirect(
      '/ia?error=' +
        encodeURIComponent(
          'IA no configurada. Cargar ANTHROPIC_API_KEY en Vercel para habilitar.'
        )
    );
  }

  // Mapear matched_service_id válidos a uuid[]
  const recommendedIds = result.recommendations
    .map((r) => r.matched_service_id)
    .filter((id): id is string => !!id && /^[0-9a-f-]{36}$/i.test(id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertPayload: any = {
    organization_id: orgId,
    client_id: clientId,
    photo_url: photoUrl,
    client_age: clientAge ?? null,
    client_objective: objective ?? null,
    ai_report: result,
    scores: result.scores,
    recommended_service_ids: recommendedIds,
  };
  const { data: row, error: insertErr } = await supabase
    .from('skin_analyses')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertErr || !row) redirect(`/ia?error=${encodeURIComponent(translateDbError(insertErr ?? { message: 'insert failed' }))}`);

  revalidatePath('/ia');
  redirect(`/ia?ok=skin-analysis-${row.id}`);
}

export async function runProtocolGeneration(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const objective = String(formData.get('main_objective') ?? '').trim();
  const budget = String(formData.get('budget_range') ?? '').trim() || undefined;
  const availability = String(formData.get('availability') ?? 'biweekly') as
    | 'weekly'
    | 'biweekly'
    | 'monthly';
  const contraindications = String(formData.get('contraindications') ?? '').trim() || undefined;

  if (!clientId || !objective) redirect('/ia?error=Falta+clienta+u+objetivo');

  const supabase = createClient();
  const { data: services } = await supabase
    .from('services')
    .select('id, name, category, duration_minutes, price_ars')
    .eq('organization_id', orgId)
    .eq('active', true);

  // Optional: incluir último skin_analysis si hay
  const { data: lastAnalysis } = await supabase
    .from('skin_analyses')
    .select('id, scores, ai_report')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const skinAnalysisInput =
    lastAnalysis && lastAnalysis.scores && lastAnalysis.ai_report
      ? {
          scores: lastAnalysis.scores as Record<string, number>,
          skin_type: (lastAnalysis.ai_report as { skin_type?: string })?.skin_type ?? 'normal',
          fitzpatrick: (lastAnalysis.ai_report as { fitzpatrick?: string })?.fitzpatrick ?? 'III',
        }
      : undefined;

  const result = await generateProtocol({
    mainObjective: objective,
    budgetRange: budget,
    availability,
    knownContraindications: contraindications,
    skinAnalysis: skinAnalysisInput,
    servicesAvailable:
      services?.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        duration_minutes: s.duration_minutes,
        price_ars: Number(s.price_ars),
      })) ?? [],
  });

  if (!result) {
    redirect(
      '/ia?error=' +
        encodeURIComponent('IA no configurada. Cargar ANTHROPIC_API_KEY en Vercel.')
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const protocolPayload: any = {
    organization_id: orgId,
    client_id: clientId,
    skin_analysis_id: lastAnalysis?.id ?? null,
    objective,
    client_input: {
      budget_range: budget,
      availability,
      contraindications,
    },
    ai_protocol: result,
    total_sessions: result.total_sessions,
    total_price_ars: result.total_price_ars,
    status: 'draft',
  };
  const { error: insertErr } = await supabase
    .from('treatment_protocols')
    .insert(protocolPayload);

  if (insertErr) redirect(`/ia?error=${encodeURIComponent(translateDbError(insertErr))}`);

  revalidatePath('/ia');
  redirect('/ia?ok=protocol-generated');
}
