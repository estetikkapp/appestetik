/**
 * Endpoint usado por el panel /configuracion para mostrar estado del bridge
 * y refrescar el QR en tiempo real.
 *
 * Auth: requiere user logueado + membership activo en la org. No usa Bearer
 * token de bridge (esto es para usuarios humanos del panel, no para el agente).
 *
 * Devuelve: estado de TODOS los bridges activos de la org + comandos
 * pendientes/processing recientes.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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

  const admin = createAdminClient();

  // Tokens activos + sus estados
  const { data: tokens } = await admin
    .from('bridge_tokens')
    .select(
      `id, label, created_at, last_seen_at,
       bridge_state ( status, phone_e164, qr_base64, qr_updated_at, last_heartbeat_at, agent_version, agent_os )`
    )
    .eq('organization_id', orgId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  // Comandos recientes (últimos 20)
  const { data: commands } = await admin
    .from('bridge_commands')
    .select('id, action, status, attempts, last_error, created_at, processed_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Cuenta de pendientes
  const { count: pendingCount } = await admin
    .from('bridge_commands')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  return NextResponse.json({
    tokens: (tokens ?? []).map((t) => {
      const stateRel = Array.isArray(t.bridge_state) ? t.bridge_state[0] : t.bridge_state;
      return {
        id: t.id,
        label: t.label,
        created_at: t.created_at,
        last_seen_at: t.last_seen_at,
        state: stateRel ?? null,
      };
    }),
    commands_recent: commands ?? [],
    pending_count: pendingCount ?? 0,
  });
}
