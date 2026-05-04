import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPayment } from '@/lib/integrations/mercadopago/client';

/**
 * Webhook de Mercado Pago.
 * MP llama a este endpoint cuando un pago cambia de estado.
 *
 * Para que MP llame: configurar la URL en el dashboard de MP del usuario:
 * https://appestetika.vercel.app/api/webhooks/mp
 *
 * Cuando MP_ACCESS_TOKEN no está cargado, el endpoint igual responde 200
 * pero no actualiza nada (graceful no-op).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = body.topic ?? body.type;
    const id = body.data?.id ?? body.resource;

    if (topic !== 'payment' || !id) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const mpPayment = await fetchPayment(String(id));
    if (!mpPayment) {
      // MP no configurado o no encontrado — no romper
      return NextResponse.json({ ok: true, no_mp: true });
    }

    const supabase = createAdminClient();

    // Buscar payment local. Cuando MP envía notificación, podemos correlacionar
    // por external_reference (que guardamos como appointmentId/clientId) o por mp_payment_id si ya fue actualizado antes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const externalRef = (mpPayment as any).external_reference as string | undefined;
    let existing: { id: string } | null = null;
    if (externalRef) {
      const { data } = await supabase
        .from('payments')
        .select('id')
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
        .select('id')
        .eq('mp_payment_id', String(id))
        .maybeSingle();
      existing = data;
    }

    if (!existing) {
      return NextResponse.json({ ok: true, not_found: true });
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
    return NextResponse.json({ ok: false, error: 'webhook_error' }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'mp-webhook' });
}
