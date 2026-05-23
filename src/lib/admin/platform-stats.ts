/**
 * Stats agregadas cross-tenant para el panel de plataforma (/admin).
 *
 * Usa el admin client (service-role, bypassa RLS) — solo debe llamarse después
 * de validar super-admin con requirePlatformAdmin().
 *
 * Todo agregado (counts), sin PII de clientas finales.
 */

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Precios mensuales por plan (ARS). Ajustar a los precios reales.
 * Se usa solo para estimar MRR en el dashboard.
 */
export const PLAN_PRICES_MONTHLY: Record<string, number> = {
  gabinete: 29990,
  equipo: 54990,
};

export interface OrgStatRow {
  org_id: string;
  name: string;
  slug: string | null;
  created_at: string;
  onboarded_at: string | null;
  plan_id: string | null;
  sub_status: string | null;
  trial_ends_at: string | null;
  whatsapp_status: string | null;
  whatsapp_provider: string | null;
  has_mp: boolean;
  afip_provider: string | null;
  services_count: number;
  clients_count: number;
  active_clients_count: number;
  appointments_count: number;
  appointments_last_30d: number;
  staff_count: number;
  last_activity_at: string | null;
}

export interface PlatformOverview {
  totalOrgs: number;
  onboardedOrgs: number;
  notOnboardedOrgs: number;
  activeOrgs30d: number;
  dormantOrgs: number;
  trialing: number;
  activeSubs: number;
  noSub: number;
  newThisWeek: number;
  newThisMonth: number;
  estimatedMrr: number;
  totalClients: number;
  totalAppointments: number;
  byPlan: Record<string, number>;
}

const DAY = 24 * 60 * 60 * 1000;

export async function loadPlatformStats(): Promise<{
  overview: PlatformOverview;
  orgs: OrgStatRow[];
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('platform_org_stats');

  if (error) {
    console.error('[platform-stats] rpc error', error);
    throw new Error('No se pudieron cargar las métricas de plataforma');
  }

  const orgs = (data ?? []) as OrgStatRow[];
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const monthAgo = now - 30 * DAY;

  const byPlan: Record<string, number> = {};
  let estimatedMrr = 0;
  let onboardedOrgs = 0;
  let activeOrgs30d = 0;
  let trialing = 0;
  let activeSubs = 0;
  let noSub = 0;
  let newThisWeek = 0;
  let newThisMonth = 0;
  let totalClients = 0;
  let totalAppointments = 0;

  for (const o of orgs) {
    if (o.onboarded_at) onboardedOrgs++;

    const created = new Date(o.created_at).getTime();
    if (created >= weekAgo) newThisWeek++;
    if (created >= monthAgo) newThisMonth++;

    const lastActivity = o.last_activity_at ? new Date(o.last_activity_at).getTime() : 0;
    if (o.appointments_last_30d > 0 || lastActivity >= monthAgo) activeOrgs30d++;

    if (o.sub_status === 'trialing') trialing++;
    else if (o.sub_status === 'active') {
      activeSubs++;
      estimatedMrr += PLAN_PRICES_MONTHLY[o.plan_id ?? ''] ?? 0;
    } else if (!o.sub_status) noSub++;

    if (o.plan_id) byPlan[o.plan_id] = (byPlan[o.plan_id] ?? 0) + 1;

    totalClients += Number(o.clients_count) || 0;
    totalAppointments += Number(o.appointments_count) || 0;
  }

  const overview: PlatformOverview = {
    totalOrgs: orgs.length,
    onboardedOrgs,
    notOnboardedOrgs: orgs.length - onboardedOrgs,
    activeOrgs30d,
    dormantOrgs: orgs.length - activeOrgs30d,
    trialing,
    activeSubs,
    noSub,
    newThisWeek,
    newThisMonth,
    estimatedMrr,
    totalClients,
    totalAppointments,
    byPlan,
  };

  return { overview, orgs };
}
