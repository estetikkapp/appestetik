// Receives Evolution API webhook events for CONNECTION_UPDATE and QRCODE_UPDATED.
// Evolution API sends POST to this URL with event data.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const instanceName = body.instance as string | undefined;

  // instanceName tiene formato "org-{orgId}"
  if (!instanceName?.startsWith('org-')) {
    return NextResponse.json({ ok: true });
  }
  const orgId = instanceName.replace(/^org-/, '');

  if (event === 'CONNECTION_UPDATE') {
    const state = (body.data as Record<string, unknown>)?.state as string | undefined;
    const admin = createAdminClient();

    if (state === 'open') {
      const phoneRaw = (body.data as Record<string, unknown>)?.instance as string | undefined;
      // phoneRaw viene como "5491112345678@s.whatsapp.net" → normalizar a +5491112345678
      const phone = phoneRaw
        ? '+' + phoneRaw.replace(/@.*$/, '')
        : null;

      await admin
        .from('organizations')
        .update({
          whatsapp_status: 'connected',
          whatsapp_phone: phone,
          whatsapp_connected_at: new Date().toISOString(),
        })
        .eq('id', orgId);
    } else if (state === 'close') {
      await admin
        .from('organizations')
        .update({
          whatsapp_status: 'disconnected',
          whatsapp_phone: null,
          whatsapp_connected_at: null,
        })
        .eq('id', orgId);
    }
  }

  return NextResponse.json({ ok: true });
}
