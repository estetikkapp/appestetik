/**
 * Wrapper de Meta Pixel (Facebook). Funciones seguras que no rompen si el
 * script no cargó (ej. en el server, o si el usuario tiene un ad-blocker).
 *
 * Se inicializa desde `src/components/analytics/meta-pixel.tsx` que inyecta
 * el snippet oficial cuando NEXT_PUBLIC_META_PIXEL_ID está seteada.
 *
 * Eventos standard de Meta que usamos:
 *   - PageView         → cada navegación, automático
 *   - Lead             → click en CTA "Probar gratis"
 *   - CompleteRegistration → cuando se crea la cuenta de Auth
 *   - StartTrial       → cuando se selecciona plan y arranca el trial real
 *                         (status='trialing' creado en plan_subscriptions)
 *
 * Trabajan el "embudo de conversión" así:
 *
 *   PageView (anónimo)
 *     ↓
 *   Lead (intención — clickeó CTA)
 *     ↓
 *   CompleteRegistration (cuenta creada)
 *     ↓
 *   StartTrial (trial activo en DB — fin del embudo de adquisición)
 *
 * Para tracking del evento Subscribe (paga el plan) lo agregamos cuando MP
 * confirme el primer pago via webhook (eso es Conversions API server-side,
 * separado de este pixel client-side).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type FbqFunction = (
  event: string,
  action: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) => void;

declare global {
  interface Window {
    fbq?: FbqFunction & { queue?: unknown[]; loaded?: boolean; version?: string };
    _fbq?: FbqFunction;
  }
}

function fbq(): FbqFunction | null {
  if (typeof window === 'undefined') return null;
  return window.fbq ?? null;
}

export function isPixelLoaded(): boolean {
  return fbq() !== null;
}

export function trackPageView(): void {
  fbq()?.('track', 'PageView');
}

export function trackLead(params?: { content_name?: string; value?: number }): void {
  fbq()?.('track', 'Lead', params);
}

export function trackCompleteRegistration(params?: { value?: number; content_name?: string }): void {
  fbq()?.('track', 'CompleteRegistration', params);
}

export function trackStartTrial(
  params?: {
    value?: number;
    currency?: string;
    predicted_ltv?: number;
    content_name?: string;
  },
  /** event_id para dedup con CAPI server-side. Si el server-side ya disparó
   *  con este mismo ID, Meta los cuenta como un solo evento. */
  eventId?: string
): void {
  fbq()?.('track', 'StartTrial', params, eventId ? { eventID: eventId } : undefined);
}

export function trackSubscribe(params?: {
  value?: number;
  currency?: string;
  predicted_ltv?: number;
}): void {
  fbq()?.('track', 'Subscribe', params);
}

/** Evento custom para cualquier cosa que no esté en el catálogo standard. */
export function trackCustom(name: string, params?: Record<string, unknown>): void {
  fbq()?.('trackCustom', name, params);
}
