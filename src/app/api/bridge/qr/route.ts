/**
 * Bridge reporta un QR actualizado.
 *
 * Body: { qr_base64: string } — el data:image/png;base64,... que generó whatsapp-web.js
 *
 * Lo guardamos en bridge_state.qr_base64 + status='qr_pending'.
 * El panel /configuracion polls /api/bridge/state y muestra el QR para que la dueña escanee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateBridge } from '@/lib/bridge/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_QR_LENGTH = 200_000; // ~150KB base64 = un QR de PNG de 400x400 con margen

export async function POST(req: NextRequest) {
  const auth = await authenticateBridge(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { qr_base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const qr = body.qr_base64;
  if (!qr || typeof qr !== 'string') {
    return NextResponse.json({ error: 'missing qr_base64' }, { status: 400 });
  }
  if (qr.length > MAX_QR_LENGTH) {
    return NextResponse.json({ error: 'qr too large' }, { status: 413 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  await admin.from('bridge_state').upsert({
    bridge_token_id: auth.tokenId,
    status: 'qr_pending',
    qr_base64: qr,
    qr_updated_at: nowIso,
    last_heartbeat_at: nowIso,
    updated_at: nowIso,
  });

  return NextResponse.json({ ok: true });
}
