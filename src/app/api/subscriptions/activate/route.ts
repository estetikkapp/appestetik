/**
 * POST /api/subscriptions/activate
 *
 * Arranca el cobro real de una suscripción en trial.
 *
 * Flujo:
 *   1) Auth (solo owner puede activar el pago)
 *   2) Resuelve el email del owner (lo precompleta MP en el checkout)
 *   3) Llama a activateRecurringSubscription:
 *        - monthly → crea preapproval (débito automático mensual)
 *        - yearly  → crea Checkout Pro one-time anual
 *   4) Devuelve { init_point } para que la UI redirija a MP
 *
 * Cuando la clienta autoriza en MP, el webhook /api/webhooks/mp-saas
 * pasa la sub a 'active'. Acá NO cambiamos el status (evita marcar active
 * una sub que abandonó el checkout).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { activateRecurringSubscription } from '@/lib/plans/subscription-service';
import { isMpConfigured } from '@/lib/integrations/mp-saas/client';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

export async function POST(_req: NextRequest) {
  const { orgId, userId } = await requireMembership({ minRole: 'owner' });

  if (!isMpConfigured()) {
    return NextResponse.json(
      {
        error:
          'Los pagos no están configurados todavía. Escribinos y activamos tu plan a mano.',
      },
      { status: 503 }
    );
  }

  // Email del owner — MP lo precompleta en el checkout.
  const admin = createAdminClient();
  let payerEmail: string | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    payerEmail = data?.user?.email ?? null;
  } catch (err) {
    console.error('[activate] getUserById fail:', err);
  }
  if (!payerEmail) {
    return NextResponse.json(
      { error: 'No pudimos obtener tu email para el pago. Contactá soporte.' },
      { status: 400 }
    );
  }

  try {
    const result = await activateRecurringSubscription({
      orgId,
      payerEmail,
      appUrl: APP_URL,
    });
    return NextResponse.json({
      ok: true,
      init_point: result.initPoint,
      kind: result.kind,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[activate] fail:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
