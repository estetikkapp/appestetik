// Evolution API client — un servidor Evolution API aloja todas las instancias.
// Cada organización tiene su propia instancia nombrada `org-{orgId}`.
// Docs: https://doc.evolution-api.com

const BASE_URL = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.EVOLUTION_API_KEY ?? '';
const FETCH_TIMEOUT_MS = 8000;

if (!BASE_URL && process.env.NODE_ENV === 'production') {
  console.warn('[whatsapp] EVOLUTION_API_URL no configurado');
}

function instanceName(orgId: string) {
  return `org-${orgId}`;
}

/**
 * Error normalizado para que la UI pueda mostrar mensajes en español
 * sin filtrar detalles internos.
 */
export class EvolutionError extends Error {
  readonly code:
    | 'no_config'
    | 'network'
    | 'timeout'
    | 'unauthorized'
    | 'not_found'
    | 'server_error'
    | 'invalid_response'
    | 'unknown';
  readonly status?: number;
  readonly detail?: string;

  constructor(
    code: EvolutionError['code'],
    message: string,
    opts?: { status?: number; detail?: string }
  ) {
    super(message);
    this.name = 'EvolutionError';
    this.code = code;
    this.status = opts?.status;
    this.detail = opts?.detail;
  }
}

async function evoFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (!BASE_URL) {
    throw new EvolutionError(
      'no_config',
      'EVOLUTION_API_URL no está configurado en Vercel.'
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        apikey: API_KEY,
        ...options.headers,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    if (cause.includes('aborted') || cause.includes('timeout')) {
      throw new EvolutionError(
        'timeout',
        'El servidor de WhatsApp no respondió a tiempo. Probablemente está caído o la URL no es alcanzable desde Vercel (IPv6 sin IPv4 fallback es la causa más común).',
        { detail: cause }
      );
    }
    throw new EvolutionError(
      'network',
      'No se pudo conectar al servidor de WhatsApp. Verificá que el VPS esté corriendo y que la URL sea accesible desde Internet (no solo IPv6).',
      { detail: cause }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (res.status === 401 || res.status === 403) {
      throw new EvolutionError(
        'unauthorized',
        'Credenciales de Evolution API rechazadas. Revisá EVOLUTION_API_KEY en Vercel.',
        { status: res.status, detail: text }
      );
    }
    if (res.status === 404) {
      throw new EvolutionError(
        'not_found',
        'Endpoint no encontrado en el servidor de WhatsApp. Puede ser que la versión de Evolution API sea distinta a la esperada.',
        { status: res.status, detail: text }
      );
    }
    if (res.status >= 500) {
      throw new EvolutionError(
        'server_error',
        `El servidor de WhatsApp devolvió error ${res.status}. Mirá los logs del VPS.`,
        { status: res.status, detail: text.slice(0, 300) }
      );
    }
    throw new EvolutionError(
      'unknown',
      `Evolution API ${res.status}`,
      { status: res.status, detail: text.slice(0, 300) }
    );
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new EvolutionError(
      'invalid_response',
      'Respuesta inválida del servidor de WhatsApp (no es JSON).',
      { detail: err instanceof Error ? err.message : String(err) }
    );
  }
}

/**
 * Healthcheck genérico — verifica que el servidor responde y la API key sirve.
 * Devuelve el detalle en vez de lanzar (más útil para UI de diagnóstico).
 */
export async function pingEvolution(): Promise<
  | { ok: true; status: number; instances: number }
  | { ok: false; code: EvolutionError['code']; message: string; detail?: string }
> {
  if (!BASE_URL) {
    return { ok: false, code: 'no_config', message: 'EVOLUTION_API_URL no configurado.' };
  }
  try {
    const data = await evoFetch<unknown[]>('/instance/fetchInstances');
    return {
      ok: true,
      status: 200,
      instances: Array.isArray(data) ? data.length : 0,
    };
  } catch (err) {
    if (err instanceof EvolutionError) {
      return { ok: false, code: err.code, message: err.message, detail: err.detail };
    }
    return {
      ok: false,
      code: 'unknown',
      message: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}

export async function createInstance(orgId: string, webhookUrl: string) {
  return evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: instanceName(orgId),
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        enabled: true,
        url: webhookUrl,
        events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      },
    }),
  });
}

export async function getQR(orgId: string): Promise<{ base64: string } | null> {
  try {
    const data = await evoFetch<{ base64?: string }>(
      `/instance/connect/${instanceName(orgId)}`
    );
    return data?.base64 ? { base64: data.base64 } : null;
  } catch {
    return null;
  }
}

export type EvolutionStatus = 'open' | 'connecting' | 'close';

export async function getInstanceStatus(orgId: string): Promise<EvolutionStatus | null> {
  try {
    const data = await evoFetch<{ instance?: { state?: EvolutionStatus } }>(
      `/instance/connectionState/${instanceName(orgId)}`
    );
    return data?.instance?.state ?? null;
  } catch {
    return null;
  }
}

export async function deleteInstance(orgId: string) {
  try {
    await evoFetch(`/instance/delete/${instanceName(orgId)}`, { method: 'DELETE' });
  } catch {
    // Si ya no existe, no es error
  }
}

export async function sendTextMessage(orgId: string, phoneE164: string, text: string) {
  // Evolution API espera número sin + y con código de país
  const number = phoneE164.replace(/^\+/, '');
  return evoFetch(`/message/sendText/${instanceName(orgId)}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      text,
    }),
  });
}
