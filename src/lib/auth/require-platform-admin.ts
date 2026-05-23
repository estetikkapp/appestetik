/**
 * Guard para el panel de plataforma (/admin) — back office de los founders.
 *
 * A diferencia de requireMembership (que valida pertenencia a una org), este
 * valida que el user logueado sea un SUPER-ADMIN de la plataforma, comparando
 * su email contra la env var PLATFORM_ADMIN_EMAILS (lista separada por comas).
 *
 *   PLATFORM_ADMIN_EMAILS=carlos@ejemplo.com,tomi@ejemplo.com
 *
 * SEGURIDAD:
 * - A quien NO es admin le devolvemos notFound() (404) en vez de 403, para no
 *   revelar que la ruta existe.
 * - La comparación es case-insensitive y trimmea espacios.
 * - Si la env var no está cargada, NADIE es admin (fail-closed).
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export function getPlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = getPlatformAdminEmails();
  if (admins.length === 0) return false; // fail-closed
  return admins.includes(email.trim().toLowerCase());
}

export interface PlatformAdmin {
  userId: string;
  email: string;
}

/**
 * Valida que el request venga de un super-admin de plataforma.
 * Lanza notFound() (404) si no hay sesión o el email no está autorizado.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdminEmail(user.email)) {
    notFound();
  }

  return { userId: user.id, email: user.email! };
}
