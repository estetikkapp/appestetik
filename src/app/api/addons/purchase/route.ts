/**
 * POST /api/addons/purchase
 *
 * Body: { addon_id: 'skin_diagnosis_50' | 'protocol_25' }
 *
 * Flujo:
 *   1) Auth (cualquier owner/admin de la org puede comprar add-ons)
 *   2) Valida sub activa
 *   3) Crea fila en ai_addon_purchases con status='pending'
 *   4) Crea Checkout Pro de MP, devuelve init_point
 *   5) Webhook MP confirma pago → applyAddonPurchase suma bonus_quota
 *
 * Si MP no está configurado: devuelve error con mensaje claro.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { getActiveSubscription } from '@/lib/plans/subscription-service';
import { ADDONS, type AddonId } from '@/lib/plans/definitions';
import { createCheckoutPreference } from '@/lib/integrations/mp-saas/checkout-pro';
import { isMpConfigured } from '@/lib/integrations/mp-saas/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

export async function POST(req: NextRequest) {
  const { orgId, userId } = await requireMembership({ minRole: 'admin' });

  let body: { addon_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const addonId = body.addon_id as AddonId;
  if (!addonId || !ADDONS[addonId]) {
    return NextResponse.json({ error: 'Add-on no disponible' }, { status: 400 });
  }
  const addon = ADDONS[addonId];

  if (!isMpConfigured()) {
    return NextResponse.json(
      { error: 'Pagos no configurados. Contactá soporte para comprar add-ons.' },
      { status: 503 }
    );
  }

  // Verificar que la org tenga sub activa (no tiene sentido comprar add-on
  // si está suspended o trial_expired — primero tienen que regularizar)
  const sub = await getActiveSubscription(orgId);
  if (!sub) {
    return NextResponse.json({ error: 'No hay suscripción activa.' }, { status: 400 });
  }
  if (sub.status === 'suspended' || sub.status === 'trial_expired') {
    return NextResponse.json(
      { error: 'Tu suscripción está suspendida — regularizá el pago antes de comprar add-ons.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const externalRef = `addon_${sub.id}_${Date.now()}`;

  // 1) Crear fila pending de ai_addon_purchases
  const { data: purchase, error: insErr } = await admin
    .from('ai_addon_purchases')
    .insert({
      subscription_id: sub.id,
      addon_type: addonId,
      quantity_added: addon.quantity,
      amount_ars: addon.price_ars,
      status: 'pending',
      mp_external_reference: externalRef,
    })
    .select('id')
    .single();

  if (insErr || !purchase) {
    return NextResponse.json({ error: `No se pudo crear la compra: ${insErr?.message}` }, { status: 500 });
  }

  // 2) Crear Checkout Pro
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();
  const orgName = org?.name ?? 'tu centro';

  let preference;
  try {
    preference = await createCheckoutPreference({
      items: [
        {
          title: addon.name,
          description: `${addon.description} — para ${orgName}`,
          quantity: 1,
          unit_price: addon.price_ars,
        },
      ],
      external_reference: externalRef,
      success_url: `${APP_URL}/ia?ok=addon-comprado`,
      failure_url: `${APP_URL}/ia?error=addon-pago-fallido`,
      back_url: `${APP_URL}/ia`,
      metadata: {
        addon_purchase_id: purchase.id,
        subscription_id: sub.id,
        addon_id: addonId,
        kind: 'addon',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    // Rollback: marcar la compra como failed para no dejar pending huérfanas
    await admin
      .from('ai_addon_purchases')
      .update({ status: 'failed', failed_at: new Date().toISOString(), failed_reason: msg })
      .eq('id', purchase.id);
    return NextResponse.json({ error: `No se pudo crear el checkout: ${msg}` }, { status: 502 });
  }

  await audit({
    organizationId: orgId,
    action: 'addon.purchase.initiate',
    entityType: 'addon_purchase',
    entityId: purchase.id,
    payload: { addon_id: addonId, amount: addon.price_ars, userId },
  });

  return NextResponse.json({
    ok: true,
    purchase_id: purchase.id,
    checkout: {
      init_point: preference.init_point,
      preference_id: preference.id,
    },
  });
}
