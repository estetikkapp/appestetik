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

  let body: { phone_e164?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Normalizar phone si vino. Aceptamos null/undefined/empty: a veces wwebjs
  // emite 'ready' antes de que client.info esté disponible y el agente reporta
  // sin phone. El estado de "conectado" igual debe propagarse — sino la org
  // queda con whatsapp_status='disconnected' y los recordatorios no se mandan
  // aunque el bridge esté operativo.
  let phone: string | null = null;
  const phoneRaw = body.phone_e164;
  if (phoneRaw && typeof phoneRaw === 'string') {
    const digits = phoneRaw.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 20) {
      phone = `+${digits}`;
    }
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Para org.whatsapp_phone: solo overwrite si tenemos un phone valido.
  // Sin phone preservamos lo que ya estaba (puede que se haya capturado en una
  // conexion anterior).
  const orgUpdate: Record<string, unknown> = {
    whatsapp_status: 'connected',
    whatsapp_connected_at: nowIso,
    whatsapp_provider: 'local_bridge',
  };
  if (phone) orgUpdate.whatsapp_phone = phone;

  const stateUpdate: Record<string, unknown> = {
    bridge_token_id: auth.tokenId,
    status: 'ready',
    qr_base64: null,
    qr_updated_at: null,
    last_heartbeat_at: nowIso,
    updated_at: nowIso,
  };
  if (phone) stateUpdate.phone_e164 = phone;

  await Promise.all([
    admin.from('bridge_state').upsert(stateUpdate),
    admin.from('organizations').update(orgUpdate).eq('id', auth.organizationId),
  ]);

  return NextResponse.json({ ok: true, phone_captured: !!phone });
}
