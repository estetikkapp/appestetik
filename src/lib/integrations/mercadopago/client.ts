import { MercadoPagoConfig, Preference, Payment as MpPayment } from 'mercadopago';

/**
 * Cliente Mercado Pago. Requiere `MP_ACCESS_TOKEN` env var.
 *
 * IMPORTANTE: en Sprint 3 se conecta con creds reales del centro. Por ahora
 * funciona con `placeholder-mp-token` y las operaciones devolverán errores
 * controlados (capturados con try/catch en los Server Actions).
 */
export function getMpClient(): MercadoPagoConfig | null {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken || accessToken === 'placeholder' || accessToken.startsWith('placeholder')) {
    return null;
  }
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });
}

export interface CreatePreferenceInput {
  appointmentId?: string;
  clientId: string;
  amountArs: number;
  description: string;
  payerEmail?: string;
  successUrl: string;
  failureUrl: string;
}

/**
 * Crea una preference de pago en MP y devuelve el link de checkout.
 * Si MP no está configurado, retorna null y el caller debe usar un método alternativo.
 */
export async function createPaymentPreference(
  input: CreatePreferenceInput
): Promise<{ preferenceId: string; initPoint: string } | null> {
  const client = getMpClient();
  if (!client) return null;

  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: [
        {
          id: input.appointmentId ?? input.clientId,
          title: input.description,
          quantity: 1,
          unit_price: input.amountArs,
          currency_id: 'ARS',
        },
      ],
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      back_urls: {
        success: input.successUrl,
        failure: input.failureUrl,
      },
      auto_return: 'approved',
      external_reference: input.appointmentId ?? input.clientId,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mp`,
    },
  });

  if (!result.id || !result.init_point) return null;
  return { preferenceId: result.id, initPoint: result.init_point };
}

export async function fetchPayment(mpPaymentId: string) {
  const client = getMpClient();
  if (!client) return null;
  const payment = new MpPayment(client);
  return await payment.get({ id: mpPaymentId });
}
