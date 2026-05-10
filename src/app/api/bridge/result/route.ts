/**
 * Bridge reporta resultado de un comando ya ejecutado.
 *
 * Body: { id: string, ok: boolean, error?: string }
 * Marca el comando como 'sent' o 'failed'.
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

  let body: { id?: string; ok?: boolean; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { id, ok, error } = body;
  if (!id || typeof ok !== 'boolean') {
    return NextResponse.json({ error: 'missing id or ok' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from('bridge_commands')
    .update({
      status: ok ? 'sent' : 'failed',
      processed_at: new Date().toISOString(),
      last_error: ok ? null : (error ?? 'unknown error').slice(0, 500),
    })
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .in('status', ['processing', 'pending']);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
