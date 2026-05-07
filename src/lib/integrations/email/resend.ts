/**
 * Cliente HTTP minimal para Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Por qué fetch en vez del SDK oficial: el SDK trae un par de deps innecesarias
 * para nuestro caso. Un POST simple alcanza.
 *
 * Config:
 *   RESEND_API_KEY        - api key (re_xxx)
 *   RESEND_FROM_EMAIL     - from por defecto. Ej: "appestetika <hola@estetikkapp.com>"
 *                            Si no está, usa onboarding@resend.dev (solo testing)
 *
 * Si RESEND_API_KEY no está cargado, sendEmail hace un no-op y loguea warning.
 * Esto permite que el resto del flow no rompa en dev.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Tags opcionales para tracking en el dashboard de Resend */
  tags?: Array<{ name: string; value: string }>;
}

/** Códigos categorizados para que el caller pueda mostrar mensajes específicos. */
export type SendEmailErrorCode =
  | 'no_api_key' // RESEND_API_KEY no configurado
  | 'unauthorized' // 401: api key inválida
  | 'domain_not_verified' // 403/422: dominio del from no verificado en Resend
  | 'invalid_recipient' // 422: email destino inválido
  | 'rate_limited' // 429
  | 'server_error' // 5xx
  | 'network' // no se pudo conectar
  | 'unknown';

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  code?: SendEmailErrorCode;
  /** Detalle técnico crudo para diagnóstico (no se muestra al user final). */
  detail?: string;
}

function defaultFrom() {
  return (
    process.env.RESEND_FROM_EMAIL ??
    'appestetika <onboarding@resend.dev>'
  );
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('placeholder')) {
    console.warn('[email/resend] RESEND_API_KEY no configurado — no-op');
    return {
      ok: false,
      error: 'no_api_key',
      code: 'no_api_key',
    };
  }

  let res: Response;
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from ?? defaultFrom(),
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
        tags: input.tags,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email/resend] fetch error:', msg);
    return {
      ok: false,
      error: 'network',
      code: 'network',
      detail: msg,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let parsed: { name?: string; message?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // continúa con text crudo
    }

    const errMsg = parsed.message ?? text.slice(0, 300);
    const errName = parsed.name ?? '';
    let code: SendEmailErrorCode = 'unknown';

    if (res.status === 401) code = 'unauthorized';
    else if (res.status === 429) code = 'rate_limited';
    else if (res.status >= 500) code = 'server_error';
    else if (
      // Resend 422 con domain_not_found o similar
      errName === 'validation_error' &&
      (errMsg.toLowerCase().includes('domain') ||
        errMsg.toLowerCase().includes('verify') ||
        errMsg.toLowerCase().includes('from'))
    ) {
      code = 'domain_not_verified';
    } else if (
      errName === 'validation_error' &&
      errMsg.toLowerCase().includes('to')
    ) {
      code = 'invalid_recipient';
    } else if (res.status === 403) {
      code = 'domain_not_verified';
    }

    console.error(`[email/resend] ${res.status} (${code}): ${errMsg}`);
    return {
      ok: false,
      error: errMsg,
      code,
      detail: text.slice(0, 500),
    };
  }

  try {
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    return {
      ok: false,
      error: 'invalid_response',
      code: 'unknown',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Healthcheck: verifica si el dominio del FROM_EMAIL está verificado en Resend.
 * Útil para el panel de diagnóstico.
 *
 * GET /domains lista los dominios de la cuenta con status. Si el dominio del
 * FROM_EMAIL aparece como `verified` o `pending`, todo OK / pendiente DNS.
 */
export interface DomainStatus {
  ok: boolean;
  hasApiKey: boolean;
  fromEmail: string | null;
  fromDomain: string | null;
  /** Status del dominio en Resend: verified | pending | failed | not_found | unknown */
  domainStatus?: 'verified' | 'pending' | 'failed' | 'not_found' | 'unknown';
  /** Si la API key fue rechazada al consultar Resend */
  authFailed?: boolean;
  detail?: string;
}

export async function checkResendDomain(): Promise<DomainStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? null;

  if (!apiKey || apiKey.startsWith('placeholder')) {
    return {
      ok: false,
      hasApiKey: false,
      fromEmail,
      fromDomain: null,
    };
  }

  // Extraer el dominio del FROM_EMAIL ("Nombre <foo@bar.com>" o "foo@bar.com")
  const fromDomain = fromEmail
    ? (fromEmail.match(/<([^>]+)>/)?.[1] ?? fromEmail).split('@')[1] ?? null
    : null;

  if (!fromDomain) {
    return {
      ok: false,
      hasApiKey: true,
      fromEmail,
      fromDomain: null,
      domainStatus: 'not_found',
      detail: 'RESEND_FROM_EMAIL inválido (no tiene @dominio).',
    };
  }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401) {
      return {
        ok: false,
        hasApiKey: true,
        fromEmail,
        fromDomain,
        authFailed: true,
        detail: 'API key rechazada por Resend (401). Generá una nueva en resend.com.',
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        hasApiKey: true,
        fromEmail,
        fromDomain,
        domainStatus: 'unknown',
        detail: `Resend respondió ${res.status} al listar dominios.`,
      };
    }
    const json = (await res.json()) as {
      data?: Array<{ name?: string; status?: string }>;
    };
    const domain = (json.data ?? []).find(
      (d) => d.name?.toLowerCase() === fromDomain.toLowerCase()
    );
    if (!domain) {
      return {
        ok: false,
        hasApiKey: true,
        fromEmail,
        fromDomain,
        domainStatus: 'not_found',
        detail: `El dominio ${fromDomain} no está agregado a tu cuenta de Resend.`,
      };
    }
    const status = (domain.status ?? '').toLowerCase();
    return {
      ok: status === 'verified',
      hasApiKey: true,
      fromEmail,
      fromDomain,
      domainStatus:
        status === 'verified'
          ? 'verified'
          : status === 'pending'
            ? 'pending'
            : status === 'failed'
              ? 'failed'
              : 'unknown',
    };
  } catch (err) {
    return {
      ok: false,
      hasApiKey: true,
      fromEmail,
      fromDomain,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
