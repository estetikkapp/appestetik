/**
 * Bridge reporta que WhatsApp se conectó exitosamente.
 *
 * Body: { phone_e164: string } — número linkeado (formato +5491155551234)
 *
 * Server:
 *  - bridge_state: status='ready', phone_e164, clear qr_base64
 *  - organizations: whatsapp_status='connected', whatsapp_phone, whatsapp_connected_at
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

  let body: { phone_e164?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const phoneRaw = body.phone_e164;
  if (!phoneRaw || typeof phoneRaw !== 'string') {
    return NextResponse.json({ error: 'missing phone_e164' }, { status: 400 });
  }

  // Normalizar: aceptar con o sin '+', solo dígitos del resto
  const digits = phoneRaw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 20) {
    return NextResponse.json({ error: 'invalid phone format' }, { status: 400 });
  }
  const phone = `+${digits}`;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  await Promise.all([
    admin.from('bridge_state').upsert({
      bridge_token_id: auth.tokenId,
      status: 'ready',
      phone_e164: phone,
      qr_base64: null,
      qr_updated_at: null,
      last_heartbeat_at: nowIso,
      updated_at: nowIso,
    }),
    admin
      .from('organizations')
      .update({
        whatsapp_status: 'connected',
        whatsapp_phone: phone,
        whatsapp_connected_at: nowIso,
        whatsapp_provider: 'local_bridge',
      })
      .eq('id', auth.organizationId),
  ]);

  return NextResponse.json({ ok: true });
}
