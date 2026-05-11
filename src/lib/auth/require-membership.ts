/**
 * Helper canónico de auth para server actions: verifica que el user logueado
 * sea miembro activo de la org indicada en cookie `active_org`.
 *
 * Crítico para acciones que combinan cookie + `createAdminClient()` — sin
 * este check, un user logueado podría setear `active_org` a cualquier UUID
 * y el admin client (que bypassa RLS) ejecutaría la query sobre esa org.
 *
 * Uso:
 *   const { orgId, userId, role } = await requireMembership();
 *   const admin = createAdminClient();  // OK: ya validamos.
 *
 *   // Si requiere role específico:
 *   const { orgId } = await requireMembership({ minRole: 'admin' });
 *
 * Lanza redirect si no hay sesión, si no hay org activa, si el user no es
 * miembro, o si el rol es insuficiente.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROLE_RANK, type Role } from './roles';

// Re-export para no romper imports existentes que ya usan `from
// 'require-membership'`. La fuente de verdad sigue siendo `./roles`.
export type { Role };
export { ROLE_RANK };

export interface MembershipCheck {
  /** auth.users.id del logueado */
  userId: string;
  /** organizations.id de la cookie validada */
  orgId: string;
  /** rol activo del user en esa org */
  role: Role;
}

export interface RequireMembershipOpts {
  /** Si se pasa, exige que el user tenga al menos este rol (rank). */
  minRole?: Role;
  /** URL a la que redirigir si falla (no sesion / no miembro). Default: `/auth/login`. */
  redirectOnFail?: string;
  /**
   * URL a la que redirigir si está logueado pero le falta rango (minRole no
   * alcanza). Default: `/`. Distinto de `redirectOnFail` porque acá el user
   * SÍ está autenticado, solo no autorizado para esa sección.
   */
  redirectOnInsufficientRole?: string;
}

export async function requireMembership(
  opts: RequireMembershipOpts = {}
): Promise<MembershipCheck> {
  const fail = opts.redirectOnFail ?? '/auth/login';
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(fail);

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect(fail);

  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .maybeSingle();

  if (!m) {
    // El user NO es miembro de esa org → no puede tocarla aunque la cookie diga eso.
    redirect(`${fail}?error=Sin+acceso+a+esa+organizaci%C3%B3n`);
  }

  if (opts.minRole) {
    const minRank = ROLE_RANK[opts.minRole];
    const userRank = ROLE_RANK[m.role as Role] ?? 0;
    if (userRank < minRank) {
      // Acá el user SÍ tiene sesión y SÍ es miembro de la org — solo le falta
      // rango. Redirigirlo a /auth/login sería confuso (lo dejaría rebotando
      // contra el middleware). Lo mandamos al home con un mensaje.
      const insufficientRedirect = opts.redirectOnInsufficientRole ?? '/';
      redirect(`${insufficientRedirect}?error=No+ten%C3%A9s+permiso+para+esa+secci%C3%B3n`);
    }
  }

  return {
    userId: user.id,
    orgId,
    role: m.role as Role,
  };
}
