import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPaymentForOrg, loadMpConfig } from '@/lib/integrations/mercadopago/client';

export const runtime = 'nodejs';

/**
 * Webhook de Mercado Pago — multi-tenant.
 *
 * Mercado Pago llama a este endpoint cuando un pago cambia de estado.
 * Como cada org tiene sus propias credenciales MP, primero resolvemos a qué
 * org pertenece el pago via `external_reference` (que guardamos como
 * appointmentId/clientId) o via `mp_payment_id` ya guardado, y después
 * usamos las creds de esa org para validar firma + traer detalles.
 *
 * Flujo:
 *   1. Recibir notificación con id de payment
 *   2. Buscar payment local → obtener org_id
 *   3. Cargar mp_config de esa org → obtener webhook_secret
 *   4. Validar firma con ese secret (si la org tiene secret cargado)
 *   5. Llamar fetchPaymentForOrg(org_id, payment_id) → obtener estado
 *   6. Update local payment con nuevo estado
 */

function verifyMpSignature(
  req: NextRequest,
  dataId: string,
  webhookSecret: string | null | undefined
): boolean {
  if (!webhookSecret) return true; // sin secret cargado: skip (modo basic)

  const signatureHeader = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id') ?? '';
  if (!signatureHeader) return false;

  const tsMatch = signatureHeader.match(/ts=(\d+)/);
  const v1Match = signatureHeader.match(/v1=([a-f0-9]+)/);
  if (!tsMatch || !v1Match) return false;

  const ts = tsMatch[1]!;
  const expectedHash = v1Match[1]!;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const computed = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  return (
    computed.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = body.topic ?? body.type;
    const id = body.data?.id ?? body.resource;

    if (topic !== 'payment' || !id) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = createAdminClient();

    // Buscar payment local por external_reference o mp_payment_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const externalRef = body.data?.external_reference as string | undefined;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let existing: { id: string; organization_id: string } | null = null;
    if (externalRef && UUID_RE.test(externalRef)) {
      const { data } = await supabase
        .from('payments')
        .select('id, organization_id')
        .or(`appointment_id.eq.${externalRef},client_id.eq.${externalRef}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = data;
    }
    if (!existing) {
      const { data } = await supabase
        .from('payments')
        .select('id, organization_id')
        .eq('mp_payment_id', String(id))
        .maybeSingle();
      existing = data;
    }

    if (!existing) {
      return NextResponse.json({ ok: true, not_found: true });
    }

    // Cargar config de esa org y validar firma
    const cfg = await loadMpConfig(existing.organization_id);
    if (!verifyMpSignature(request, String(id), cfg?.webhook_secret ?? null)) {
      console.warn('[mp webhook] firma inválida para org', existing.organization_id);
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    // Traer detalles del payment desde MP usando creds de la org
    const mpPayment = await fetchPaymentForOrg(existing.organization_id, String(id));
    if (!mpPayment) {
      // Org no tiene MP configurado → no podemos updatear
      return NextResponse.json({ ok: true, no_mp_config: true });
    }

    const status = mpPayment.status;
    let localStatus: 'approved' | 'rejected' | 'refunded' | 'cancelled' | 'pending' = 'pending';
    if (status === 'approved') localStatus = 'approved';
    else if (status === 'rejected') localStatus = 'rejected';
    else if (status === 'refunded') localStatus = 'refunded';
    else if (status === 'cancelled') localStatus = 'cancelled';

    await supabase
      .from('payments')
      .update({
        mp_payment_id: String(id),
        status: localStatus,
        paid_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .eq('id', existing.id);

    return NextResponse.json({ ok: true, updated: existing.id, status: localStatus });
  } catch (err) {
    console.error('[mp webhook]', err);
    return NextResponse.json({ ok: false, error: 'webhook_error' }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'mp-webhook' });
}
