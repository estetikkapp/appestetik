// Polled by the UI every 3s during QR flow to check connection status.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getQR, getInstanceStatus } from '@/lib/integrations/whatsapp/evolution';

export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

  const { data: org } = await supabase
    .from('organizations')
    .select('whatsapp_status, whatsapp_phone')
    .eq('id', orgId)
    .single();

  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  if (org.whatsapp_status === 'connected') {
    return NextResponse.json({
      status: 'connected',
      phone: org.whatsapp_phone,
    });
  }

  if (org.whatsapp_status === 'connecting') {
    const [evoStatus, qr] = await Promise.all([
      getInstanceStatus(orgId),
      getQR(orgId),
    ]);

    if (evoStatus === 'open') {
      return NextResponse.json({ status: 'connected', phone: org.whatsapp_phone });
    }

    return NextResponse.json({
      status: 'connecting',
      qr: qr?.base64 ?? null,
    });
  }

  return NextResponse.json({ status: 'disconnected' });
}
