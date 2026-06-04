/**
 * Lista de usuarios SaaS (todas las personas registradas en appestetika)
 * para el panel super-admin (/admin/usuarios).
 *
 * Usa el admin client (service-role) — solo debe llamarse después de
 * validar super-admin con requirePlatformAdmin().
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface PlatformUserRow {
  user_id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  membership_id: string | null;
  org_id: string | null;
  org_name: string | null;
  org_slug: string | null;
  role: 'owner' | 'admin' | 'professional' | 'receptionist' | null;
  display_name: string | null;
  membership_active: boolean | null;
  membership_created_at: string | null;
  invitation_accepted_at: string | null;
}

export interface PlatformUsersOverview {
  totalUsers: number;
  confirmedUsers: number;
  unconfirmedUsers: number;
  usersWithoutOrg: number;
  activeLast30d: number;
  byRole: Record<string, number>;
  newThisWeek: number;
  newThisMonth: number;
}

const DAY = 24 * 60 * 60 * 1000;

export async function loadPlatformUsers(): Promise<{
  overview: PlatformUsersOverview;
  users: PlatformUserRow[];
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('platform_users');

  if (error) {
    console.error('[platform-users] rpc error', error);
    throw new Error('No se pudieron cargar los usuarios de plataforma');
  }

  const rows = (data ?? []) as PlatformUserRow[];

  // Dedup por user_id para los counts de overview (un user puede aparecer en
  // varias filas si pertenece a más de una org).
  const uniqueUsers = new Map<string, PlatformUserRow>();
  for (const r of rows) {
    if (!uniqueUsers.has(r.user_id)) uniqueUsers.set(r.user_id, r);
  }

  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const monthAgo = now - 30 * DAY;

  const byRole: Record<string, number> = {};
  let confirmedUsers = 0;
  let usersWithoutOrg = 0;
  let activeLast30d = 0;
  let newThisWeek = 0;
  let newThisMonth = 0;

  for (const u of uniqueUsers.values()) {
    if (u.email_confirmed_at) confirmedUsers++;
    if (!u.org_id) usersWithoutOrg++;
    if (u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= monthAgo) {
      activeLast30d++;
    }
    const created = new Date(u.created_at).getTime();
    if (created >= weekAgo) newThisWeek++;
    if (created >= monthAgo) newThisMonth++;
  }

  // Roles: contamos filas (no users únicos), porque cada membership es una relación distinta.
  for (const r of rows) {
    if (r.role) byRole[r.role] = (byRole[r.role] ?? 0) + 1;
  }

  const overview: PlatformUsersOverview = {
    totalUsers: uniqueUsers.size,
    confirmedUsers,
    unconfirmedUsers: uniqueUsers.size - confirmedUsers,
    usersWithoutOrg,
    activeLast30d,
    byRole,
    newThisWeek,
    newThisMonth,
  };

  return { overview, users: rows };
}
