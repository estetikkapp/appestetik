/**
 * WhatsApp Cloud API (Meta oficial) — alternativa a Evolution / Baileys.
 *
 * Por qué existe: Meta bloquea Baileys desde IPs de datacenter (failure 405).
 * Cloud API oficial funciona desde cualquier IP. Cada org carga sus propias
 * credenciales Meta Business — no hay un "instance manager" como Evolution.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Config por org (en organizations.whatsapp_cloud_config):
 *   - phone_number_id: ID del número de WhatsApp Business (panel Meta)
 *   - business_account_id: ID de la cuenta de WhatsApp Business
 *   - access_token: Token permanente del System User (NO el temporal de 24h)
 *   - verify_token: secreto que setea el panel para validar el webhook
 */

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const FETCH_TIMEOUT_MS = 10000;

export interface WhatsappCloudConfig {
  phone_number_id: string;
  business_account_id?: string;
  access_token: string;
  verify_token?: string;
}

export class WhatsappCloudError extends Error {
  readonly code:
    | 'no_config'
    | 'network'
    | 'timeout'
    | 'unauthorized'
    | 'rate_limited'
    | 'invalid_phone'
    | 'template_required'
    | 'unknown';
  readonly status?: number;
  readonly detail?: string;

  constructor(
    code: WhatsappCloudError['code'],
    message: string,
    opts?: { status?: number; detail?: string }
  ) {
    super(message);
    this.name = 'WhatsappCloudError';
    this.code = code;
    this.status = opts?.status;
    this.detail = opts?.detail;
  }
}

async function graphFetch<T = unknown>(
  path: string,
  config: WhatsappCloudConfig,
  options: RequestInit = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GRAPH_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    if (cause.includes('aborted') || cause.includes('timeout')) {
      throw new WhatsappCloudError(
        'timeout',
        'Meta no respondió a tiempo. Reintentar en unos segundos.',
        { detail: cause }
      );
    }
    throw new WhatsappCloudError(
      'network',
      'No se pudo conectar a Meta. Verificá conectividad a graph.facebook.com.',
      { detail: cause }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let parsed: { error?: { message?: string; code?: number; error_subcode?: number } } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // continúa con el text crudo
    }
    const errMsg = parsed.error?.message ?? text.slice(0, 200);
    const errCode = parsed.error?.code;

    if (res.status === 401 || res.status === 403 || errCode === 190) {
      throw new WhatsappCloudError(
        'unauthorized',
        'Token de acceso de Meta inválido o expirado. Generá uno nuevo en Meta Business → System Users.',
        { status: res.status, detail: errMsg }
      );
    }
    if (res.status === 429 || errCode === 4) {
      throw new WhatsappCloudError(
        'rate_limited',
        'Demasiadas solicitudes a Meta. Esperá 1 minuto y reintentá.',
        { status: res.status, detail: errMsg }
      );
    }
    // Errores comunes de mensajes
    if (errCode === 131026) {
      throw new WhatsappCloudError(
        'invalid_phone',
        'El número de destinatario no tiene WhatsApp.',
        { status: res.status, detail: errMsg }
      );
    }
    if (errCode === 131047 || errCode === 131051) {
      throw new WhatsappCloudError(
        'template_required',
        'Esta clienta no inició conversación en las últimas 24h. Para reabrir, hay que usar un template aprobado por Meta.',
        { status: res.status, detail: errMsg }
      );
    }
    throw new WhatsappCloudError(
      'unknown',
      errMsg || `Error Meta ${res.status}`,
      { status: res.status, detail: text.slice(0, 300) }
    );
  }

  return (await res.json()) as T;
}

/**
 * Healthcheck — verifica que las credenciales son válidas.
 * Hace GET al phone_number_id que devuelve metadata del número.
 */
export async function pingCloudApi(config: WhatsappCloudConfig): Promise<
  | {
      ok: true;
      phone: { display_phone_number: string; verified_name: string; quality_rating?: string };
    }
  | { ok: false; code: WhatsappCloudError['code']; message: string; detail?: string }
> {
  if (!config.phone_number_id || !config.access_token) {
    return { ok: false, code: 'no_config', message: 'Falta phone_number_id o access_token' };
  }
  try {
    const data = await graphFetch<{
      display_phone_number: string;
      verified_name: string;
      quality_rating?: string;
    }>(`/${config.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, config);
    return { ok: true, phone: data };
  } catch (err) {
    if (err instanceof WhatsappCloudError) {
      return { ok: false, code: err.code, message: err.message, detail: err.detail };
    }
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Error' };
  }
}

/**
 * Manda un mensaje de texto. Funciona dentro de la "ventana de servicio" de 24h
 * (la clienta tiene que haber iniciado o respondido en las últimas 24h).
 *
 * Para mensajes proactivos (recordatorios) hay que usar un template aprobado
 * (sendTemplateMessage). Texto libre fuera de ventana → error template_required.
 */
export async function sendCloudText(
  config: WhatsappCloudConfig,
  toPhoneE164: string,
  text: string
): Promise<{ messageId: string }> {
  // Cloud API espera el número sin el "+", solo dígitos
  const to = toPhoneE164.replace(/^\+/, '').replace(/\D/g, '');

  const result = await graphFetch<{ messages?: Array<{ id: string }> }>(
    `/${config.phone_number_id}/messages`,
    config,
    {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  const messageId = result.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsappCloudError('unknown', 'Respuesta de Meta sin messageId.');
  }
  return { messageId };
}

/**
 * Manda un mensaje basado en un template aprobado por Meta. Necesario para
 * mensajes proactivos (fuera de ventana de 24h) — ej. recordatorios, promos.
 *
 * El template tiene que estar previamente creado y aprobado en el panel
 * Meta Business → WhatsApp Manager → Plantillas. Languages comunes: 'es_AR', 'es'.
 */
export async function sendCloudTemplate(
  config: WhatsappCloudConfig,
  toPhoneE164: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = []
): Promise<{ messageId: string }> {
  const to = toPhoneE164.replace(/^\+/, '').replace(/\D/g, '');

  const components =
    bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: bodyParams.map((p) => ({ type: 'text', text: p })),
          },
        ]
      : undefined;

  const result = await graphFetch<{ messages?: Array<{ id: string }> }>(
    `/${config.phone_number_id}/messages`,
    config,
    {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      }),
    }
  );

  const messageId = result.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsappCloudError('unknown', 'Respuesta de Meta sin messageId.');
  }
  return { messageId };
}
