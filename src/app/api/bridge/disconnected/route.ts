/**
 * Bridge reporta que WhatsApp se desconectó (logout o pérdida de sesión).
 *
 * Body: { reason?: string }
 *
 * Server:
 *  - bridge_state: status='disconnected'
 *  - organizations: whatsapp_status='disconnected' (solo si provider es 'local_bridge')
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateBridge } from '@/lib/bridge/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await authenticateBridge(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body opcional
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  await admin.from('bridge_state').upsert({
    bridge_token_id: auth.tokenId,
    status: 'disconnected',
    phone_e164: null,
    qr_base64: null,
    qr_updated_at: null,
    last_heartbeat_at: nowIso,
    updated_at: nowIso,
  });

  // Solo marcamos org como disconnected si el provider activo es local_bridge.
  // (Si el user había cambiado a otro provider, no pisamos su estado.)
  const { data: org } = await admin
    .from('organizations')
    .select('whatsapp_provider')
    .eq('id', auth.organizationId)
    .maybeSingle();

  if (org?.whatsapp_provider === 'local_bridge') {
    await admin
      .from('organizations')
      .update({
        whatsapp_status: 'disconnected',
        whatsapp_phone: null,
        whatsapp_connected_at: null,
      })
      .eq('id', auth.organizationId);
  }

  console.log('[bridge/disconnected]', {
    org_id: auth.organizationId,
    reason: body.reason ?? 'unknown',
  });

  return NextResponse.json({ ok: true });
}
