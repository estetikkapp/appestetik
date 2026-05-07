import { MercadoPagoConfig, Preference, Payment as MpPayment } from 'mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Cliente Mercado Pago — per-org.
 *
 * Cada organization tiene su propio `mp_config` (access_token + public_key +
 * webhook_secret). Las acciones que necesitan MP llaman a `loadMpConfig(orgId)`
 * para obtener las credenciales correctas y construyen el cliente con esas.
 *
 * Si la org no tiene MP configurado, las funciones devuelven null y el caller
 * debe usar un método alternativo o mostrar error informativo.
 */

export interface MpOrgConfig {
  access_token: string;
  public_key?: string | null;
  webhook_secret?: string | null;
}

export async function loadMpConfig(orgId: string): Promise<MpOrgConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('organizations')
    .select('mp_config')
    .eq('id', orgId)
    .maybeSingle();

  const cfg = data?.mp_config as MpOrgConfig | null | undefined;
  if (!cfg?.access_token) return null;
  if (cfg.access_token.startsWith('placeholder')) return null;
  return cfg;
}

function buildClient(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });
}

export interface CreatePreferenceInput {
  orgId: string;
  appointmentId?: string;
  clientId: string;
  amountArs: number;
  description: string;
  payerEmail?: string;
  successUrl: string;
  failureUrl: string;
}

/**
 * Crea una preference de pago en MP usando las credenciales de la org.
 * Retorna null si la org no tiene MP configurado.
 */
export async function createPaymentPreference(
  input: CreatePreferenceInput
): Promise<{ preferenceId: string; initPoint: string } | null> {
  const cfg = await loadMpConfig(input.orgId);
  if (!cfg) return null;

  const client = buildClient(cfg.access_token);
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

/**
 * Fetch del estado actual de un payment en MP usando creds de la org.
 * Llamado desde el webhook handler cuando ya identificamos a qué org pertenece
 * el pago (via external_reference o mp_payment_id ya guardado).
 */
export async function fetchPaymentForOrg(orgId: string, mpPaymentId: string) {
  const cfg = await loadMpConfig(orgId);
  if (!cfg) return null;
  const client = buildClient(cfg.access_token);
  const payment = new MpPayment(client);
  return await payment.get({ id: mpPaymentId });
}
