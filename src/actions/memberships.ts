'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const ACTIVE_ORG_COOKIE = 'active_org';

/**
 * Cambia la organización activa del user (via cookie).
 * Valida que el user tenga membership en esa org antes de setear.
 */
export async function switchActiveOrg(formData: FormData): Promise<void> {
  const orgId = String(formData.get('org_id') ?? '');
  if (!orgId) redirect('/?error=Organizaci%C3%B3n+inv%C3%A1lida');

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Verificar membership válido
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .maybeSingle();

  if (!membership) redirect('/?error=No+ten%C3%A9s+acceso+a+esa+organizaci%C3%B3n');

  cookies().set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/', 'layout');
  redirect('/');
}
