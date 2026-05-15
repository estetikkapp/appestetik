/**
 * Rate limiting para endpoints publicos.
 *
 * Por que server-side y no Edge: las server actions corren en lambdas;
 * un counter en memoria se pierde entre invocaciones. Usamos un counter
 * en Postgres con upsert atomico (ver migration 20260515000001).
 *
 * Strategy:
 * - Por defecto, key por IP. La IP la sacamos del header x-forwarded-for
 *   que setea Vercel con la IP real del cliente.
 * - Para casos especiales (ej. cancelacion por turno), se puede pasar
 *   un suffix custom para limitar por turno_id en lugar de IP.
 *
 * No bloquea con throw — devuelve { ok, retryAfterMinutes } para que la
 * caller decida si redirect/error.
 */

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

interface RateLimitResult {
  ok: boolean;
  retryAfterMinutes?: number;
}

/**
 * IP del cliente. En Vercel viene en x-forwarded-for; primer valor de la
 * lista es la IP real (los demas son proxies).
 */
function getClientIp(): string {
  const h = headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0];
    if (first) return first.trim();
  }
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/**
 * Chequea si la operacion esta dentro del limite.
 *
 * @param action  identificador de la accion (ej. 'public_booking', 'public_cancel')
 * @param maxCount  cuantos intentos permitidos en la ventana
 * @param windowMinutes  duracion de la ventana en minutos
 * @param keySuffix  opcional: extiende la key default (IP). Util para limitar
 *                   tambien por entidad, ej. `appt:${apptId}` para evitar que
 *                   ataquen un turno especifico desde IPs distintas.
 */
export async function checkRateLimit(
  action: string,
  maxCount: number,
  windowMinutes: number,
  keySuffix?: string
): Promise<RateLimitResult> {
  const ip = getClientIp();
  const key = keySuffix ? `${action}:${ip}:${keySuffix}` : `${action}:${ip}`;

  try {
    const admin = createAdminClient();
    // Cast porque database.ts no tiene los tipos de la migration nueva
    // (se regenera con `npm run db:types`). La firma esta tipada arriba via
    // RateLimitResult, asi que callers siguen seguros.
    const rpcCall = admin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
    const { data, error } = await rpcCall('check_rate_limit', {
      p_key: key,
      p_max_count: maxCount,
      p_window_minutes: windowMinutes,
    });
    if (error) {
      // Fail-open: si la DB esta caida no queremos bloquear users legitimos.
      // Loggeamos para detectar si hay un problema persistente.
      console.error('[rate-limit] DB error, fail-open:', error.message);
      return { ok: true };
    }
    if (data === false) {
      return { ok: false, retryAfterMinutes: windowMinutes };
    }
    return { ok: true };
  } catch (err) {
    console.error('[rate-limit] exception, fail-open:', err);
    return { ok: true };
  }
}
