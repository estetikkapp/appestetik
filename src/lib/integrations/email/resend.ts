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

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
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
    return { ok: false, error: 'no_api_key' };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
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
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.error(`[email/resend] ${res.status}: ${text}`);
      return { ok: false, error: `${res.status}: ${text}` };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email/resend] fetch error:', msg);
    return { ok: false, error: msg };
  }
}
