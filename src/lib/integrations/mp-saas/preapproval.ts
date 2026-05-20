/**
 * Wrapper de MP Preapproval para suscripciones mensuales con débito
 * automático.
 *
 * Flujo:
 *   1) Cliente clickea "activar mi plan mensual" en /configuracion
 *   2) Creamos preapproval con `auto_recurring` mensual
 *   3) Redirigimos al `init_point` — el cliente autoriza el débito en MP
 *   4) MP guarda el preapproval con status 'authorized'
 *   5) Cada mes, MP ejecuta el débito y manda webhook con el payment_id
 *   6) Nuestro webhook llama markPaymentSucceeded → extiende el período
 *   7) Si el débito falla, MP reintenta y nos manda webhook con failed
 *
 * Cancelar preapproval = la sub deja de cobrar pero los datos quedan
 * disponibles en MP por si reactivan después.
 */

import { mpFetch } from './client';

export interface CreatePreapprovalParams {
  /** Email del pagador. MP lo precompleta. */
  payer_email: string;
  /** "Suscripción Equipo — appestetika" o similar. Lo ve la clínica en MP. */
  reason: string;
  /** Monto del débito mensual. */
  transaction_amount: number;
  /** Lo usa el webhook para matchear. */
  external_reference: string;
  /** URL post-autorización exitosa. */
  back_url: string;
}

export interface MpPreapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  /** URL donde el user autoriza el débito. */
  init_point: string;
  external_reference: string;
  reason: string;
  payer_email: string;
  next_payment_date: string | null;
  auto_recurring: {
    frequency: number;
    frequency_type: 'months' | 'days';
    transaction_amount: number;
    currency_id: string;
  };
}

export async function createPreapproval(
  params: CreatePreapprovalParams
): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      payer_email: params.payer_email,
      back_url: params.back_url,
      reason: params.reason,
      external_reference: params.external_reference,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.transaction_amount,
        currency_id: 'ARS',
      },
      status: 'pending', // pasará a authorized cuando el user confirme
    }),
  });
}

/** Cancela el preapproval en MP. Llamar al hacer cancelSubscription. */
export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  await mpFetch(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

export async function fetchPreapproval(preapprovalId: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${preapprovalId}`);
}
