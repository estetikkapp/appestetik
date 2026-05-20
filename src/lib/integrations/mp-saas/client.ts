/**
 * Cliente Mercado Pago para cobros del SaaS appestetika (cobrar a las
 * clínicas que pagan suscripción).
 *
 * IMPORTANTE: distinto del cliente `lib/integrations/mercadopago/` (per-org)
 * que usan las clínicas para cobrar a SUS clientas. Acá usamos UN solo token
 * de la cuenta MP de appestetika para todas las clínicas.
 *
 * Env var requerida:
 *   MP_APPESTETIKA_ACCESS_TOKEN    Access token productivo de la cuenta MP
 *                                  de appestetika. Se obtiene en
 *                                  mercadopago.com.ar → Tu app → Credentials.
 *
 *   MP_APPESTETIKA_WEBHOOK_SECRET  Secret HMAC para validar firmas de webhooks.
 *                                  Se setea en MP → Webhooks → Firma secreta.
 *
 * Comportamiento sin token configurado:
 *   - Las funciones que llaman a MP (createCheckoutSession, createPreapproval)
 *     lanzan MpNotConfiguredError. El caller (server action o API handler)
 *     responde con un mensaje al user tipo "Pagos no configurados, contactar
 *     soporte" en vez de un 500.
 *   - El webhook acepta llamadas sin validar firma (modo dev/setup), pero
 *     solo procesa si hay token (porque necesita pegarle a MP para confirmar
 *     el estado del pago).
 */

const MP_API_BASE = 'https://api.mercadopago.com';

export class MpNotConfiguredError extends Error {
  constructor() {
    super('Mercado Pago de appestetika no configurado. Falta MP_APPESTETIKA_ACCESS_TOKEN.');
    this.name = 'MpNotConfiguredError';
  }
}

export function getAccessToken(): string {
  const token = process.env.MP_APPESTETIKA_ACCESS_TOKEN;
  if (!token) throw new MpNotConfiguredError();
  return token;
}

export function isMpConfigured(): boolean {
  return Boolean(process.env.MP_APPESTETIKA_ACCESS_TOKEN);
}

export function getWebhookSecret(): string | null {
  return process.env.MP_APPESTETIKA_WEBHOOK_SECRET ?? null;
}

/**
 * Fetch con autenticación + retry básico. Lanza si el response no es 2xx.
 */
export async function mpFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MP ${path} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Devuelve detalles de un pago via /v1/payments/{id}.
 * Usado en el webhook para confirmar estado real (no confiar solo en
 * el payload del webhook).
 */
export interface MpPayment {
  id: number;
  status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  payment_type_id: string;
  date_created: string;
  date_approved: string | null;
  metadata?: Record<string, unknown>;
}

export async function fetchPayment(paymentId: string | number): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
}

/**
 * Verifica la firma HMAC de un webhook. Algoritmo oficial de MP:
 *
 *   manifest = "id:DATA_ID;request-id:REQ_ID;ts:TS;"
 *   hmac     = HMAC-SHA256(manifest, webhook_secret)
 *
 * Headers:
 *   x-signature: "ts=<UNIX_TS>,v1=<HEX_HMAC>"
 *   x-request-id: UUID
 *
 * Si el secret no está configurado, devuelve true (modo basic — útil para
 * dev/local; en producción setear MP_APPESTETIKA_WEBHOOK_SECRET).
 */
export function verifyWebhookSignature(
  headers: Headers,
  dataId: string
): boolean {
  const secret = getWebhookSecret();
  if (!secret) return true; // modo basic

  const signature = headers.get('x-signature');
  const requestId = headers.get('x-request-id') ?? '';
  if (!signature) return false;

  const tsMatch = signature.match(/ts=(\d+)/);
  const v1Match = signature.match(/v1=([a-f0-9]+)/);
  if (!tsMatch || !v1Match) return false;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto') as typeof import('node:crypto');
  const manifest = `id:${dataId};request-id:${requestId};ts:${tsMatch[1]};`;
  const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  if (computed.length !== v1Match[1]!.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v1Match[1]!));
}
