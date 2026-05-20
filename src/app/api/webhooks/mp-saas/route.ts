/**
 * POST /api/webhooks/mp-saas
 *
 * Webhook de Mercado Pago — cuenta del SaaS appestetika (NO confundir con
 * /api/webhooks/mp que es per-org para cobros clínica→paciente).
 *
 * Recibe notificaciones de:
 *   - Pagos del Checkout Pro (upgrades, addons, yearly subs)
 *   - Pagos recurrentes de preapprovals (monthly subs)
 *
 * Flujo:
 *   1) Verificar firma HMAC con MP_APPESTETIKA_WEBHOOK_SECRET
 *   2) Si es topic=payment, traer detalles via MP API
 *   3) Match por external_reference → saas_invoice o ai_addon_purchase
 *   4) Si payment.status='approved' → marcar como paid + aplicar efectos
 *   5) Si payment.status='rejected' → markPaymentFailed (retry o suspend)
 *
 * Idempotente: si recibimos el webhook 2 veces del mismo payment, la 2da
 * lo detecta porque la fila ya está en estado terminal y no hace nada.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchPayment,
  verifyWebhookSignature,
  isMpConfigured,
  MpNotConfiguredError,
} from '@/lib/integrations/mp-saas/client';
import {
  markPaymentSucceeded,
  markPaymentFailed,
} from '@/lib/plans/subscription-service';
import { applyAddonPurchase } from '@/lib/plans/ai-quota-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isMpConfigured()) {
    // En dev sin token: aceptar pero no procesar
    return NextResponse.json({ ok: true, skipped: 'mp_not_configured' });
  }

  let body: { type?: string; topic?: string; data?: { id?: string }; resource?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const topic = body.type ?? body.topic;
  const dataId = String(body.data?.id ?? body.resource ?? '');
  if (!dataId) {
    return NextResponse.json({ ok: true, ignored: 'no data id' });
  }

  // Verificar firma
  if (!verifyWebhookSignature(req.headers, dataId)) {
    console.warn('[mp-saas webhook] firma inválida para data.id=', dataId);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  if (topic !== 'payment') {
    // Por ahora solo procesamos payments. Para preapprovals MP manda
    // notifications cuando cobra exitosamente, y eso viene como un payment
    // separado con external_reference del preapproval.
    return NextResponse.json({ ok: true, ignored: topic });
  }

  let payment;
  try {
    payment = await fetchPayment(dataId);
  } catch (err) {
    if (err instanceof MpNotConfiguredError) {
      return NextResponse.json({ ok: true, skipped: 'mp_not_configured' });
    }
    console.error('[mp-saas webhook] fetchPayment fail:', err);
    return NextResponse.json({ error: 'No se pudo traer payment' }, { status: 502 });
  }

  const externalRef = payment.external_reference;
  if (!externalRef) {
    return NextResponse.json({ ok: true, ignored: 'no external_reference' });
  }

  const admin = createAdminClient();

  // Match: ¿es addon o invoice?
  // Convención: external_reference de addons empieza con 'addon_'
  if (externalRef.startsWith('addon_')) {
    return await handleAddonPayment(admin, externalRef, payment);
  }

  // Sino, es una saas_invoice (lookup directo por external_reference)
  return await handleInvoicePayment(externalRef, payment);
}

// ────────────────────────────────────────────────────────────────────────────
// Handlers
// ────────────────────────────────────────────────────────────────────────────

async function handleAddonPayment(
  admin: ReturnType<typeof createAdminClient>,
  externalRef: string,
  payment: { id: number; status: string; status_detail: string }
) {
  const { data: purchase } = await admin
    .from('ai_addon_purchases')
    .select('id, status')
    .eq('mp_external_reference', externalRef)
    .maybeSingle();

  if (!purchase) {
    console.warn('[mp-saas webhook] addon purchase no encontrada:', externalRef);
    return NextResponse.json({ ok: true, ignored: 'unknown_addon' });
  }
  if (purchase.status === 'paid') {
    // Idempotencia: ya aplicado, no hacer nada
    return NextResponse.json({ ok: true, idempotent: true });
  }

  if (payment.status === 'approved') {
    try {
      // applyAddonPurchase marca paid + suma bonus_quota
      await applyAddonPurchase(purchase.id);
      await admin
        .from('ai_addon_purchases')
        .update({ mp_payment_id: String(payment.id) })
        .eq('id', purchase.id);
    } catch (err) {
      console.error('[mp-saas webhook] applyAddonPurchase fail:', err);
      return NextResponse.json({ error: 'fallo al aplicar addon' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: 'addon_applied' });
  }

  if (['rejected', 'cancelled'].includes(payment.status)) {
    await admin
      .from('ai_addon_purchases')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failed_reason: payment.status_detail,
        mp_payment_id: String(payment.id),
      })
      .eq('id', purchase.id);
    return NextResponse.json({ ok: true, action: 'addon_failed' });
  }

  // pending / in_process / authorized / etc → esperamos próxima notif
  return NextResponse.json({ ok: true, action: 'noop', payment_status: payment.status });
}

async function handleInvoicePayment(
  externalRef: string,
  payment: { id: number; status: string; status_detail: string }
) {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from('saas_invoices')
    .select('id, subscription_id, status')
    .eq('mp_external_reference', externalRef)
    .maybeSingle();

  if (!invoice) {
    console.warn('[mp-saas webhook] invoice no encontrada:', externalRef);
    return NextResponse.json({ ok: true, ignored: 'unknown_invoice' });
  }
  if (invoice.status === 'paid') {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  if (payment.status === 'approved') {
    try {
      await markPaymentSucceeded(invoice.subscription_id, String(payment.id), invoice.id);
    } catch (err) {
      console.error('[mp-saas webhook] markPaymentSucceeded fail:', err);
      return NextResponse.json({ error: 'fallo al confirmar pago' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: 'invoice_paid' });
  }

  if (['rejected', 'cancelled'].includes(payment.status)) {
    try {
      await markPaymentFailed(invoice.subscription_id, invoice.id, payment.status_detail);
    } catch (err) {
      console.error('[mp-saas webhook] markPaymentFailed fail:', err);
      return NextResponse.json({ error: 'fallo al marcar fallido' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: 'invoice_failed' });
  }

  return NextResponse.json({ ok: true, action: 'noop', payment_status: payment.status });
}
