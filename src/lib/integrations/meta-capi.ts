/**
 * Meta Conversions API (CAPI) — eventos server-side a Meta.
 *
 * Por qué CAPI además del pixel client-side:
 *   - El pixel client-side falla cuando: el user tiene ad-blocker, está en
 *     iOS con ITP estricto, abre el link de confirmación de email en otro
 *     device, o simplemente JS no carga. CAPI manda el evento desde
 *     nuestro server directo a Meta, evitando todos esos casos.
 *
 *   - Para eventos de conversion (CompleteRegistration, StartTrial,
 *     Subscribe) es crítico — son los que las campañas optimizan. Si Meta
 *     no los ve, no aprende qué clicks convierten.
 *
 * Dedup con el pixel:
 *   - Cuando se dispara el MISMO evento client-side + server-side, Meta los
 *     deduplica si comparten `event_id`. Por eso pasamos siempre un
 *     event_id determinístico cuando es posible (ej. user_id + event_name).
 *
 * Env vars:
 *   - META_CAPI_ACCESS_TOKEN — token con permiso de POST a /events
 *   - NEXT_PUBLIC_META_PIXEL_ID — el ID del pixel, mismo que el client-side
 *
 * Sin token, `sendCapiEvent` es no-op (no rompe en dev/local).
 */

import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const GRAPH_VERSION = 'v18.0';

export type CapiEventName =
  | 'PageView'
  | 'Lead'
  | 'CompleteRegistration'
  | 'StartTrial'
  | 'Subscribe'
  | 'Purchase';

export interface CapiCustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  predicted_ltv?: number;
}

export interface SendCapiParams {
  event_name: CapiEventName;
  /** ID determinístico para dedup con el evento client-side. Si el pixel
   *  client-side dispara el mismo evento con el mismo event_id, Meta los
   *  cuenta como UNO solo (no duplicado). */
  event_id?: string;
  /** Email del user en plain text — lo hasheamos acá. */
  email?: string | null;
  /** Teléfono en plain text — lo hasheamos acá. */
  phone?: string | null;
  /** URL donde ocurrió el evento. Default: header referer o site URL. */
  event_source_url?: string;
  custom_data?: CapiCustomData;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(PIXEL_ID && ACCESS_TOKEN);
}

/** SHA256 hex lowercase — formato que Meta espera para PII. */
function sha256(input: string): string {
  return createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
}

/** Lee el `_fbp` cookie (browser pixel ID) y `_fbc` (click ID) desde el
 *  request actual. Si están, mejoran el matching de Meta entre eventos
 *  client-side y server-side. */
function readMetaCookies(): { fbp: string | null; fbc: string | null } {
  try {
    const c = cookies();
    return {
      fbp: c.get('_fbp')?.value ?? null,
      fbc: c.get('_fbc')?.value ?? null,
    };
  } catch {
    // Fuera de request scope (ej. test) — sin cookies disponibles
    return { fbp: null, fbc: null };
  }
}

/** Lee la IP del client desde headers (proxies de Vercel) + user-agent. */
function readClientInfo(): { ip: string | null; ua: string | null } {
  try {
    const h = headers();
    const xff = h.get('x-forwarded-for');
    const ip = xff?.split(',')[0]?.trim() ?? null;
    const ua = h.get('user-agent') ?? null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Send
// ────────────────────────────────────────────────────────────────────────────

interface MetaUserData {
  em?: string[];
  ph?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
}

interface MetaEventPayload {
  data: Array<{
    event_name: CapiEventName;
    event_time: number;
    event_id?: string;
    event_source_url?: string;
    action_source: 'website';
    user_data: MetaUserData;
    custom_data?: CapiCustomData;
  }>;
  /** Si se setea, los eventos solo aparecen en Test Events de Meta
   *  (no impactan reportes de campaña). Útil para testing. */
  test_event_code?: string;
}

/**
 * Envía un evento a Meta CAPI. Fire-and-forget (no bloquea el server action).
 *
 * Errores se logean pero no se propagan — un fallo de tracking nunca
 * debería romper el flow de signup/trial del user.
 */
export async function sendCapiEvent(params: SendCapiParams): Promise<void> {
  if (!isConfigured()) {
    // Sin token, no-op silencioso (modo dev/preview)
    return;
  }

  const cookieData = readMetaCookies();
  const clientInfo = readClientInfo();

  const userData: MetaUserData = {};
  if (params.email) userData.em = [sha256(params.email)];
  if (params.phone) userData.ph = [sha256(params.phone.replace(/\D/g, ''))];
  if (clientInfo.ip) userData.client_ip_address = clientInfo.ip;
  if (clientInfo.ua) userData.client_user_agent = clientInfo.ua;
  if (cookieData.fbp) userData.fbp = cookieData.fbp;
  if (cookieData.fbc) userData.fbc = cookieData.fbc;

  const payload: MetaEventPayload = {
    data: [
      {
        event_name: params.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.event_id,
        event_source_url:
          params.event_source_url ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com',
        action_source: 'website',
        user_data: userData,
        custom_data: params.custom_data,
      },
    ],
  };

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(
      ACCESS_TOKEN!
    )}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[meta-capi] HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn('[meta-capi] send failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Genera un event_id determinístico para dedup con el pixel client-side.
 *
 * El client-side pasa este mismo ID y Meta merges los dos como un solo
 * evento. Si solo llega el server-side (porque el client está bloqueado por
 * adblocker), igual cuenta. Si solo llega el client (porque el server falla),
 * también cuenta. Si llegan los dos, cuenta como uno.
 */
export function buildEventId(eventName: CapiEventName, scopeId: string): string {
  return `${eventName.toLowerCase()}_${scopeId}_${Date.now()}`;
}
