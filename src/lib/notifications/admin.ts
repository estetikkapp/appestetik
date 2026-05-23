/**
 * Notificaciones al equipo de appestetika cuando pasan cosas importantes en
 * el embudo de adquisición: nuevo signup, nuevo trial activado, primer pago
 * confirmado, etc.
 *
 * Destino: env var ADMIN_NOTIFICATION_EMAILS (CSV). Default si no está
 * configurada: estetikkapp@gmail.com. Sin email seteado = no-op.
 *
 * Filosofía: nunca bloquear el flow del usuario. Si Resend falla o no está
 * configurado, log + sigue. La notificación es nice-to-have, no crítica.
 *
 * Para no spammear el inbox, cada función envía un solo email por evento
 * con asunto descriptivo + cuerpo HTML estructurado.
 */

import { sendEmail } from '@/lib/integrations/email/resend';
import { PLANS, type PlanId, type BillingCycle } from '@/lib/plans/definitions';
import { formatArs } from '@/lib/utils/format-ars';

const DEFAULT_ADMIN_EMAIL = 'estetikkapp@gmail.com';

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_NOTIFICATION_EMAILS;
  if (!raw) return [DEFAULT_ADMIN_EMAIL];
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Wrapper que nunca lanza. Útil para no romper signups si Resend falla. */
async function safeSend(input: Parameters<typeof sendEmail>[0]): Promise<void> {
  try {
    const result = await sendEmail(input);
    if (!result.ok) {
      console.warn(
        '[notifications/admin] envío falló:',
        result.code ?? 'unknown',
        result.error ?? ''
      );
    }
  } catch (err) {
    console.warn('[notifications/admin] exception:', err instanceof Error ? err.message : err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Signup completado — nueva clínica registrada
// ────────────────────────────────────────────────────────────────────────────
//
// Solo se dispara para signups del path público (nueva org, nueva dueña).
// Las invitaciones de empleadas NO disparan esta notificación — la dueña
// del centro ya las invitó, está al tanto.

export async function notifyAdminNewSignup(params: {
  email: string;
  fullName?: string | null;
  organizationName?: string | null;
}): Promise<void> {
  const to = getAdminEmails();
  if (to.length === 0) return;

  const subject = `[appestetika] Nueva clínica: ${params.email}`;

  const html = `
<!DOCTYPE html>
<html lang="es-AR"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1917;">
  <div style="background:#fbe9e5;padding:16px;border-radius:12px;margin-bottom:24px;">
    <div style="font-size:12px;color:#a85f58;text-transform:uppercase;font-weight:600;letter-spacing:1px;">appestetika · admin</div>
    <h1 style="margin:8px 0 0;font-size:18px;color:#1c1917;">Nueva clínica registrada</h1>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;color:#78716c;width:140px;">Email</td><td style="padding:8px 0;font-weight:500;">${escapeHtml(params.email)}</td></tr>
    ${
      params.fullName
        ? `<tr><td style="padding:8px 0;color:#78716c;">Nombre</td><td style="padding:8px 0;font-weight:500;">${escapeHtml(params.fullName)}</td></tr>`
        : ''
    }
    ${
      params.organizationName
        ? `<tr><td style="padding:8px 0;color:#78716c;">Centro</td><td style="padding:8px 0;font-weight:500;">${escapeHtml(params.organizationName)}</td></tr>`
        : ''
    }
    <tr><td style="padding:8px 0;color:#78716c;">Fecha</td><td style="padding:8px 0;">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td></tr>
  </table>

  <p style="margin-top:24px;font-size:13px;color:#78716c;">
    Nueva clínica creada. Todavía no eligió plan — en el próximo paso del
    onboarding aparece el plan picker. Si elige uno, te llega otro email
    "trial activado".
  </p>
</body></html>`;

  await safeSend({
    to,
    subject,
    html,
    text: `Nueva clínica registrada\n\nEmail: ${params.email}\n${params.fullName ? `Nombre: ${params.fullName}\n` : ''}${params.organizationName ? `Centro: ${params.organizationName}\n` : ''}Fecha: ${new Date().toISOString()}`,
    tags: [
      { name: 'type', value: 'admin_notification' },
      { name: 'event', value: 'new_signup' },
    ],
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Trial activado — eligieron plan
// ────────────────────────────────────────────────────────────────────────────

export async function notifyAdminTrialStarted(params: {
  email?: string | null;
  organizationName: string;
  planId: PlanId;
  billingCycle: BillingCycle;
}): Promise<void> {
  const to = getAdminEmails();
  if (to.length === 0) return;

  const plan = PLANS[params.planId];
  const planName = plan?.name ?? params.planId;
  const price =
    params.billingCycle === 'yearly'
      ? plan?.price_yearly_ars
      : plan?.price_monthly_ars;

  const subject = `[appestetika] Trial activado: ${params.organizationName} · ${planName}`;

  const html = `
<!DOCTYPE html>
<html lang="es-AR"><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1917;">
  <div style="background:#dcfce7;padding:16px;border-radius:12px;margin-bottom:24px;">
    <div style="font-size:12px;color:#15803d;text-transform:uppercase;font-weight:600;letter-spacing:1px;">appestetika · trial activado</div>
    <h1 style="margin:8px 0 0;font-size:18px;color:#1c1917;">Eligieron plan ${planName}</h1>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;color:#78716c;width:140px;">Centro</td><td style="padding:8px 0;font-weight:500;">${escapeHtml(params.organizationName)}</td></tr>
    ${
      params.email
        ? `<tr><td style="padding:8px 0;color:#78716c;">Dueña</td><td style="padding:8px 0;font-weight:500;">${escapeHtml(params.email)}</td></tr>`
        : ''
    }
    <tr><td style="padding:8px 0;color:#78716c;">Plan</td><td style="padding:8px 0;font-weight:500;">${escapeHtml(planName)}</td></tr>
    <tr><td style="padding:8px 0;color:#78716c;">Ciclo</td><td style="padding:8px 0;">${params.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}</td></tr>
    ${
      price
        ? `<tr><td style="padding:8px 0;color:#78716c;">Valor</td><td style="padding:8px 0;font-weight:500;">${formatArs(price)}${params.billingCycle === 'yearly' ? '/año' : '/mes'}</td></tr>`
        : ''
    }
    <tr><td style="padding:8px 0;color:#78716c;">Fecha</td><td style="padding:8px 0;">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td></tr>
  </table>

  <p style="margin-top:24px;font-size:13px;color:#78716c;">
    Trial de 14 días arrancado. Si al día 14 cargan método de pago en MP, queda como cliente pagador. Sino pasa a <em>trial_expired</em>.
  </p>
</body></html>`;

  await safeSend({
    to,
    subject,
    html,
    text: `Trial activado\n\nCentro: ${params.organizationName}\nPlan: ${planName}\nCiclo: ${params.billingCycle}\n${price ? `Valor: ${formatArs(price)}` : ''}`,
    tags: [
      { name: 'type', value: 'admin_notification' },
      { name: 'event', value: 'trial_started' },
      { name: 'plan', value: params.planId },
    ],
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
