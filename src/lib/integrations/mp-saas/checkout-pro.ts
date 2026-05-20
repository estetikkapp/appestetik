/**
 * Wrapper de MP Checkout Pro para cobros one-shot del SaaS:
 *   - Plan anual (decisión 4B: no auto-renew, pago único)
 *   - Upgrade diff (decisión 7A: cobramos diferencia plana)
 *   - Add-ons IA (pack 50 diagnósticos / 25 protocolos)
 *
 * Para suscripciones mensuales con débito automático ver `preapproval.ts`.
 */

import { mpFetch } from './client';

export interface CheckoutItem {
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
}

export interface CreateCheckoutParams {
  items: CheckoutItem[];
  /** Lo usa el webhook para matchear con nuestra fila (sub/invoice/addon). */
  external_reference: string;
  /** URL post-pago exitoso. */
  success_url: string;
  /** URL post-pago fallido. */
  failure_url: string;
  /** URL si el user clickea "volver al sitio". */
  back_url: string;
  /** Email del pagador (la clínica) — MP lo precompleta en el checkout. */
  payer_email?: string;
  /** Metadata libre — la guarda MP y la vuelve en el webhook. */
  metadata?: Record<string, string | number>;
  /** Texto que aparece en el resumen del Checkout Pro de la clínica. */
  statement_descriptor?: string;
}

export interface CheckoutPreference {
  id: string;
  /** URL productiva (lo que abrimos en el browser de la clínica). */
  init_point: string;
  /** URL sandbox (para testing). */
  sandbox_init_point: string;
  external_reference: string;
}

/**
 * Crea una preference de Checkout Pro. Devuelve init_point para redirigir.
 *
 * Comportamiento del back_urls:
 *   - auto_return: 'approved' → MP redirige automáticamente al success_url
 *     una vez aprobado el pago (sino, queda en pantalla de MP con un botón
 *     "volver al sitio")
 */
export async function createCheckoutPreference(
  params: CreateCheckoutParams
): Promise<CheckoutPreference> {
  const body = {
    items: params.items.map((i) => ({
      title: i.title,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      currency_id: 'ARS',
    })),
    external_reference: params.external_reference,
    back_urls: {
      success: params.success_url,
      failure: params.failure_url,
      pending: params.success_url, // tratamos pending como success y el webhook ajusta
    },
    auto_return: 'approved',
    payer: params.payer_email ? { email: params.payer_email } : undefined,
    metadata: params.metadata,
    statement_descriptor: params.statement_descriptor ?? 'appestetika',
    // notification_url debería ser /api/webhooks/mp-saas, pero MP también lo
    // toma de la config global de la cuenta. Mejor setearlo allá para no
    // duplicarlo en cada preference.
  };

  return mpFetch<CheckoutPreference>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
