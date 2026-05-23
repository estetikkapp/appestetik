/**
 * Mails de recuperación de onboarding.
 *
 * Cadencia: 1 día, 3 días, 7 días después del signup (si onboarded_at sigue
 * null). Cada user recibe MÁXIMO un mail de cada tipo — dedup via tabla
 * onboarding_recovery_emails.
 *
 * Cada template tiene 2 variantes según `hasActivity`:
 *   - Sin actividad: la cuenta es zombie (creó y no tocó nada). Copy
 *     genérico "no llegaste a terminar" + foco en mostrar el valor.
 *   - Con actividad: cargó clientas/servicios/turnos pero no terminó el
 *     último paso (definir slug = URL pública). Copy específico "te
 *     falta poco" para no insultar el tiempo que ya invirtió.
 *
 * Tono: cómplice argentino, voseo, sin presión agresiva. Cada mail tiene
 * CTA al onboarding + opción de responder por mail para ayuda manual.
 */

import { sendEmail } from '@/lib/integrations/email/resend';

export type RecoveryEmailKind = 'recovery_1' | 'recovery_2' | 'recovery_3';

/** Horas después del signup en las que se dispara cada email. */
export const RECOVERY_THRESHOLDS_HOURS: Record<RecoveryEmailKind, number> = {
  recovery_1: 24, // 1 día
  recovery_2: 72, // 3 días
  recovery_3: 168, // 7 días
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

interface RecoveryEmailParams {
  to: string;
  displayName: string | null;
  orgName: string | null;
  /**
   * Si la org ya tiene actividad real (clientas, turnos o servicios cargados)
   * cambia el copy del mail: en vez de "no llegaste a terminar" decimos
   * "ya cargaste cosas, te falta poco". Es la diferencia entre alguien que
   * abrió la cuenta y se fue vs. alguien que casi termina y se trabó en el
   * último paso.
   */
  hasActivity: boolean;
}

interface RecoveryTemplate {
  subject: string;
  html: string;
  text: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Email 1 — 24h post-signup, tono suave
// ────────────────────────────────────────────────────────────────────────────

function template1(p: RecoveryEmailParams): RecoveryTemplate {
  const name = (p.displayName ?? '').trim().split(' ')[0] || '';
  const greeting = name ? `Hola ${name},` : 'Hola,';

  const subject = p.hasActivity
    ? 'Te falta solo el último paso en appestetika'
    : '¿Te trabaste con appestetika?';

  const intro = p.hasActivity
    ? 'Vimos que ayer arrancaste a cargar tus datos en appestetika — buenísimo. Pero te falta el último paso: definir tu URL pública (algo como <strong>estetikkapp.com/tu-centro</strong>) para que tus clientas puedan reservar online. Toma menos de 30 segundos.'
    : 'Vimos que ayer creaste tu cuenta en appestetika pero no llegaste a terminar el setup. Pasa, todo bien.';

  const introText = p.hasActivity
    ? 'Vimos que ayer arrancaste a cargar tus datos en appestetika — buenísimo. Pero te falta el último paso: definir tu URL pública (algo como estetikkapp.com/tu-centro) para que tus clientas puedan reservar online. Toma menos de 30 segundos.'
    : 'Vimos que ayer creaste tu cuenta en appestetika pero no llegaste a terminar el setup. Pasa, todo bien.';

  const cta = p.hasActivity ? 'Terminar el setup' : 'Retomar el setup';

  const html = `<!DOCTYPE html>
<html lang="es-AR"><body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafaf9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;">
<tr><td style="padding:32px 32px 16px;">
<p style="margin:0;font-size:20px;font-weight:700;color:#a85f58;letter-spacing:-0.02em;">appestetika</p>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<p style="margin:0 0 12px;font-size:15px;color:#1c1917;line-height:1.6;">${greeting}</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">${intro}</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Si tenés alguna duda o algo no te cierra, escribime — atendemos por mail (<a href="mailto:estetikkapp@gmail.com" style="color:#a85f58;">estetikkapp@gmail.com</a>). Yo te paso el paso a paso de lo que te falte.</p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 16px;">
<a href="${APP_URL}/onboarding" style="display:inline-block;background:#a85f58;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">${cta}</a>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.6;">Cualquier cosa, dale.</p>
<p style="margin:8px 0 0;font-size:13px;color:#78716c;line-height:1.6;">— Tomás, creador de appestetika</p>
</td></tr>
<tr><td style="padding:0 32px 24px;border-top:1px solid #f5f5f4;">
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;line-height:1.5;">appestetika &middot; gesti&oacute;n para centros de est&eacute;tica<br>Hecho en Argentina &middot; <a href="${APP_URL}" style="color:#a85f58;">estetikkapp.com</a></p>
</td></tr>
</table>
</td></tr></table></body></html>`;

  const text = `${greeting}

${introText}

Si tenés alguna duda o algo no te cierra, escribime — atendemos por mail (estetikkapp@gmail.com). Yo te paso el paso a paso de lo que te falte.

${cta}: ${APP_URL}/onboarding

Cualquier cosa, dale.

— Tomás, creador de appestetika`;

  return { subject, html, text };
}

// ────────────────────────────────────────────────────────────────────────────
// Email 2 — 72h post-signup, foco en valor concreto
// ────────────────────────────────────────────────────────────────────────────

function template2(p: RecoveryEmailParams): RecoveryTemplate {
  const name = (p.displayName ?? '').trim().split(' ')[0] || '';
  const greeting = name ? `Hola ${name},` : 'Hola,';

  // 2 variantes: si ya hay actividad cargada vs. cuenta zombie.
  // Para los que ya cargaron, foco en cerrar el ciclo (publicar). Para los
  // que nunca tocaron, mostramos el menú de qué hace la app.
  if (p.hasActivity) {
    const subject = 'Te quedó todo casi listo en appestetika';
    const html = `<!DOCTYPE html>
<html lang="es-AR"><body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafaf9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;">
<tr><td style="padding:32px 32px 16px;">
<p style="margin:0;font-size:20px;font-weight:700;color:#a85f58;letter-spacing:-0.02em;">appestetika</p>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<p style="margin:0 0 12px;font-size:15px;color:#1c1917;line-height:1.6;">${greeting}</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Hace unos días arrancaste con appestetika y dejaste cargada parte de tu info — clientas, servicios, lo que sea. Pero todavía no terminaste el último paso (definir tu URL pública) y eso es lo que te traba que arranque a funcionar.</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Cuando lo termines, vas a tener un link tipo <strong>estetikkapp.com/tu-centro</strong> que podés compartir en Instagram, WhatsApp, o donde quieras. Tus clientas reservan ahí, sin ida y vuelta.</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Si algo no te cerró, contame: <a href="mailto:estetikkapp@gmail.com" style="color:#a85f58;">estetikkapp@gmail.com</a>. Lo resolvemos.</p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 16px;">
<a href="${APP_URL}/onboarding" style="display:inline-block;background:#a85f58;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">Terminar el último paso</a>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.6;">Saludos,</p>
<p style="margin:8px 0 0;font-size:13px;color:#78716c;line-height:1.6;">— Tomás</p>
</td></tr>
<tr><td style="padding:0 32px 24px;border-top:1px solid #f5f5f4;">
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;line-height:1.5;">appestetika &middot; gesti&oacute;n para centros de est&eacute;tica<br>Hecho en Argentina &middot; <a href="${APP_URL}" style="color:#a85f58;">estetikkapp.com</a></p>
</td></tr>
</table>
</td></tr></table></body></html>`;

    const text = `${greeting}

Hace unos días arrancaste con appestetika y dejaste cargada parte de tu info — clientas, servicios, lo que sea. Pero todavía no terminaste el último paso (definir tu URL pública) y eso es lo que te traba que arranque a funcionar.

Cuando lo termines, vas a tener un link tipo estetikkapp.com/tu-centro que podés compartir en Instagram, WhatsApp, o donde quieras. Tus clientas reservan ahí, sin ida y vuelta.

Si algo no te cerró, contame: estetikkapp@gmail.com. Lo resolvemos.

Terminar el último paso: ${APP_URL}/onboarding

Saludos,
— Tomás`;

    return { subject, html, text };
  }

  const subject = '¿Sabías que tenés 14 días gratis?';
  const html = `<!DOCTYPE html>
<html lang="es-AR"><body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafaf9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;">
<tr><td style="padding:32px 32px 16px;">
<p style="margin:0;font-size:20px;font-weight:700;color:#a85f58;letter-spacing:-0.02em;">appestetika</p>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<p style="margin:0 0 12px;font-size:15px;color:#1c1917;line-height:1.6;">${greeting}</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Te escribo de appestetika. Hace unos días creaste tu cuenta y todavía no la usaste. Te recuerdo que tenés <strong>14 días de prueba gratis</strong>, sin tarjeta de crédito.</p>
<p style="margin:16px 0 8px;font-size:15px;color:#57534e;line-height:1.6;">Te paso lo que hacen las dueñas que arrancan en appestetika:</p>
<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#57534e;line-height:1.7;">
  <li>Eligen plan (Gabinete o Equipo)</li>
  <li>Suben su lista de clientas — de Excel, de un cuaderno, lo que tengan. La IA lo carga sola.</li>
  <li>Cargan horarios + servicios (5 minutos)</li>
  <li>Comparten su link de reservas online en Instagram</li>
</ol>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Y ahí ya empiezan a entrar turnos solos.</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Si te frenaste por algo puntual, decímelo: <a href="mailto:estetikkapp@gmail.com" style="color:#a85f58;">estetikkapp@gmail.com</a>.</p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 16px;">
<a href="${APP_URL}/onboarding" style="display:inline-block;background:#a85f58;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">Continuar el setup</a>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.6;">Saludos,</p>
<p style="margin:8px 0 0;font-size:13px;color:#78716c;line-height:1.6;">— Tomás</p>
</td></tr>
<tr><td style="padding:0 32px 24px;border-top:1px solid #f5f5f4;">
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;line-height:1.5;">appestetika &middot; gesti&oacute;n para centros de est&eacute;tica<br>Hecho en Argentina &middot; <a href="${APP_URL}" style="color:#a85f58;">estetikkapp.com</a></p>
</td></tr>
</table>
</td></tr></table></body></html>`;

  const text = `${greeting}

Te escribo de appestetika. Hace unos días creaste tu cuenta y todavía no la usaste. Te recuerdo que tenés 14 días de prueba gratis, sin tarjeta de crédito.

Te paso lo que hacen las dueñas que arrancan en appestetika:
1. Eligen plan (Gabinete o Equipo)
2. Suben su lista de clientas — de Excel, de un cuaderno, lo que tengan. La IA lo carga sola.
3. Cargan horarios + servicios (5 minutos)
4. Comparten su link de reservas online en Instagram

Y ahí ya empiezan a entrar turnos solos.

Si te frenaste por algo puntual, decímelo: estetikkapp@gmail.com.

Continuar el setup: ${APP_URL}/onboarding

Saludos,
— Tomás`;

  return { subject, html, text };
}

// ────────────────────────────────────────────────────────────────────────────
// Email 3 — 7 días post-signup, último intento, no insistir más
// ────────────────────────────────────────────────────────────────────────────

function template3(p: RecoveryEmailParams): RecoveryTemplate {
  const name = (p.displayName ?? '').trim().split(' ')[0] || '';
  const greeting = name ? `Hola ${name},` : 'Hola,';

  // Para los que tienen actividad cargada, "abandonamos?" suena raro — ya
  // pusieron tiempo cargando. El último intento debe rescatar lo que dejaron
  // a la mitad sin tirar el sentido de "última vez que te molesto".
  if (p.hasActivity) {
    const subject = 'Última: dejaste casi todo listo';
    const html = `<!DOCTYPE html>
<html lang="es-AR"><body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafaf9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;">
<tr><td style="padding:32px 32px 16px;">
<p style="margin:0;font-size:20px;font-weight:700;color:#a85f58;letter-spacing:-0.02em;">appestetika</p>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<p style="margin:0 0 12px;font-size:15px;color:#1c1917;line-height:1.6;">${greeting}</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Última que te escribo. Hace una semana cargaste tus datos en appestetika pero te quedó faltando el último paso (definir la URL pública para que tus clientas reserven). Sin ese paso, todo lo que cargaste queda en stand-by.</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Si te pasó algo (te trabaste, no entendiste algo, te resultó caro), respondé este mail con dos palabras y te ayudo a destrabarlo. <strong>Sin compromiso.</strong></p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Si lo dejaste porque cambiaste de idea, archivá el mail y listo. Cero drama.</p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 16px;">
<a href="${APP_URL}/onboarding" style="display:inline-block;background:#a85f58;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">Terminar el setup</a>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.6;">Lo cargado sigue ahí esperándote igual.</p>
<p style="margin:8px 0 0;font-size:13px;color:#78716c;line-height:1.6;">— Tomás</p>
</td></tr>
<tr><td style="padding:0 32px 24px;border-top:1px solid #f5f5f4;">
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;line-height:1.5;">Este es el último mail que te mando sobre el setup de tu cuenta. appestetika &middot; <a href="${APP_URL}" style="color:#a85f58;">estetikkapp.com</a></p>
</td></tr>
</table>
</td></tr></table></body></html>`;

    const text = `${greeting}

Última que te escribo. Hace una semana cargaste tus datos en appestetika pero te quedó faltando el último paso (definir la URL pública para que tus clientas reserven). Sin ese paso, todo lo que cargaste queda en stand-by.

Si te pasó algo (te trabaste, no entendiste algo, te resultó caro), respondé este mail con dos palabras y te ayudo a destrabarlo. Sin compromiso.

Si lo dejaste porque cambiaste de idea, archivá el mail y listo. Cero drama.

Terminar el setup: ${APP_URL}/onboarding

Lo cargado sigue ahí esperándote igual.

— Tomás

(Este es el último mail que te mando sobre el setup de tu cuenta.)`;

    return { subject, html, text };
  }

  const subject = 'Última: ¿abandonamos?';
  const html = `<!DOCTYPE html>
<html lang="es-AR"><body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafaf9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;">
<tr><td style="padding:32px 32px 16px;">
<p style="margin:0;font-size:20px;font-weight:700;color:#a85f58;letter-spacing:-0.02em;">appestetika</p>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<p style="margin:0 0 12px;font-size:15px;color:#1c1917;line-height:1.6;">${greeting}</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Última que te molesto. Ya pasó una semana desde que creaste tu cuenta de appestetika y no la usaste.</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Si nada de lo que ofrecemos te sirve, está perfecto, no respondas y archivá este mail. Cero drama.</p>
<p style="margin:0 0 12px;font-size:15px;color:#57534e;line-height:1.6;">Pero si hubo algo puntual que te frenó (no entendiste cómo conectar WhatsApp, te trabaste con AFIP, te dio miedo el precio, lo que sea), respondé este mail con 2 palabras y te ayudo. <strong>Sin compromiso.</strong></p>
</td></tr>
<tr><td align="center" style="padding:8px 32px 16px;">
<a href="${APP_URL}/onboarding" style="display:inline-block;background:#a85f58;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">Retomar</a>
</td></tr>
<tr><td style="padding:8px 32px 24px;">
<p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.6;">Si decidiste que no es para vos, todo bien también. Buena suerte con tu centro.</p>
<p style="margin:8px 0 0;font-size:13px;color:#78716c;line-height:1.6;">— Tomás</p>
</td></tr>
<tr><td style="padding:0 32px 24px;border-top:1px solid #f5f5f4;">
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;line-height:1.5;">Este es el último mail que te mando sobre el setup de tu cuenta. appestetika &middot; <a href="${APP_URL}" style="color:#a85f58;">estetikkapp.com</a></p>
</td></tr>
</table>
</td></tr></table></body></html>`;

  const text = `${greeting}

Última que te molesto. Ya pasó una semana desde que creaste tu cuenta de appestetika y no la usaste.

Si nada de lo que ofrecemos te sirve, está perfecto, no respondas y archivá este mail. Cero drama.

Pero si hubo algo puntual que te frenó (no entendiste cómo conectar WhatsApp, te trabaste con AFIP, te dio miedo el precio, lo que sea), respondé este mail con 2 palabras y te ayudo. Sin compromiso.

Retomar: ${APP_URL}/onboarding

Si decidiste que no es para vos, todo bien también. Buena suerte con tu centro.

— Tomás

(Este es el último mail que te mando sobre el setup de tu cuenta.)`;

  return { subject, html, text };
}

const TEMPLATES: Record<RecoveryEmailKind, (p: RecoveryEmailParams) => RecoveryTemplate> = {
  recovery_1: template1,
  recovery_2: template2,
  recovery_3: template3,
};

// ────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ────────────────────────────────────────────────────────────────────────────

/**
 * Envía un email de recuperación. Devuelve el messageId si el envío fue OK,
 * o un error string si falló. NO toca DB — el caller (cron) registra el
 * envío en onboarding_recovery_emails.
 */
export async function sendRecoveryEmail(
  kind: RecoveryEmailKind,
  params: RecoveryEmailParams
): Promise<{ ok: true; messageId: string | null } | { ok: false; error: string }> {
  const builder = TEMPLATES[kind];
  if (!builder) {
    return { ok: false, error: `kind inválido: ${kind}` };
  }
  const tpl = builder(params);

  const result = await sendEmail({
    to: params.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tags: [
      { name: 'type', value: 'onboarding_recovery' },
      { name: 'kind', value: kind },
    ],
  });

  if (!result.ok) {
    return {
      ok: false,
      error: `${result.code ?? 'unknown'}: ${result.error ?? 'sin detalle'}`,
    };
  }
  return { ok: true, messageId: result.id ?? null };
}
