/**
 * Templates HTML básicos para emails transaccionales.
 *
 * Diseño minimalista, mobile-first, con la paleta de marca pero contenidos
 * compatibles con clientes de email (Gmail, Outlook).
 */

interface BookingConfirmationProps {
  clientName: string;
  orgName: string;
  serviceName: string;
  startsAtFormatted: string; // ya formateada en TZ AR
  cancelUrl: string;
  securityCode: string;
}

const BASE_STYLE = `
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
color: #292524;
line-height: 1.5;
max-width: 560px;
margin: 0 auto;
padding: 24px;
`;

const BUTTON_STYLE = `
display: inline-block;
background: #be93a8;
color: white !important;
text-decoration: none;
padding: 12px 24px;
border-radius: 8px;
font-weight: 600;
margin: 16px 0;
`;

const CARD_STYLE = `
border: 1px solid #e7e5e4;
border-radius: 12px;
padding: 16px;
margin: 16px 0;
background: #fafaf9;
`;

const FOOTER_STYLE = `
border-top: 1px solid #e7e5e4;
margin-top: 32px;
padding-top: 16px;
font-size: 12px;
color: #a8a29e;
text-align: center;
`;

export function bookingConfirmationEmail(p: BookingConfirmationProps): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Reserva confirmada en ${p.orgName} — ${p.startsAtFormatted}`;

  const html = `
<div style="${BASE_STYLE}">
  <h1 style="font-size: 22px; margin-bottom: 4px;">¡Reserva recibida! 💆</h1>
  <p>Hola ${escapeHtml(p.clientName)}, te confirmamos tu turno en <strong>${escapeHtml(p.orgName)}</strong>.</p>

  <div style="${CARD_STYLE}">
    <p style="margin: 0 0 8px 0;"><strong>Servicio:</strong> ${escapeHtml(p.serviceName)}</p>
    <p style="margin: 0 0 8px 0;"><strong>Fecha y hora:</strong> ${escapeHtml(p.startsAtFormatted)}</p>
    <p style="margin: 0; color: #78716c; font-size: 13px;">Quedará pendiente de confirmación por el centro.</p>
  </div>

  <p style="margin-top: 24px;">Si necesitás cancelar o reagendar, hacelo desde acá:</p>
  <p style="text-align: center;">
    <a href="${p.cancelUrl}" style="${BUTTON_STYLE}">Gestionar mi turno</a>
  </p>

  <div style="${CARD_STYLE} background: #fef9c3; border-color: #facc15;">
    <p style="margin: 0;"><strong>Tu código de seguridad:</strong> <span style="font-family: monospace; font-size: 18px; letter-spacing: 2px;">${escapeHtml(p.securityCode)}</span></p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #78716c;">Te lo va a pedir el sistema cuando quieras cancelar o reagendar. No lo compartas.</p>
  </div>

  <div style="${FOOTER_STYLE}">
    Este email fue enviado automáticamente por <strong>${escapeHtml(p.orgName)}</strong> via appestetika.
  </div>
</div>`.trim();

  const text = `Hola ${p.clientName},

Te confirmamos tu turno en ${p.orgName}.

Servicio: ${p.serviceName}
Fecha y hora: ${p.startsAtFormatted}

Si necesitás cancelar o reagendar:
${p.cancelUrl}

Código de seguridad: ${p.securityCode}
(te lo va a pedir el sistema, no lo compartas)

— ${p.orgName} via appestetika`;

  return { subject, html, text };
}

interface AppointmentReminderProps {
  clientName: string;
  orgName: string;
  serviceName: string;
  startsAtFormatted: string;
  cancelUrl: string;
}

export function appointmentReminderEmail(p: AppointmentReminderProps): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Te esperamos mañana en ${p.orgName}`;

  const html = `
<div style="${BASE_STYLE}">
  <h1 style="font-size: 22px; margin-bottom: 4px;">Recordatorio de turno 🌿</h1>
  <p>Hola ${escapeHtml(p.clientName)}, te recordamos tu turno en <strong>${escapeHtml(p.orgName)}</strong>.</p>

  <div style="${CARD_STYLE}">
    <p style="margin: 0 0 8px 0;"><strong>Servicio:</strong> ${escapeHtml(p.serviceName)}</p>
    <p style="margin: 0;"><strong>Fecha y hora:</strong> ${escapeHtml(p.startsAtFormatted)}</p>
  </div>

  <p style="margin-top: 24px;">Si no podés venir, avisanos lo antes posible:</p>
  <p style="text-align: center;">
    <a href="${p.cancelUrl}" style="${BUTTON_STYLE}">Cancelar o reagendar</a>
  </p>

  <div style="${FOOTER_STYLE}">
    ${escapeHtml(p.orgName)} · appestetika
  </div>
</div>`.trim();

  const text = `Hola ${p.clientName},

Te recordamos tu turno en ${p.orgName}.

Servicio: ${p.serviceName}
Fecha y hora: ${p.startsAtFormatted}

Si no podés venir: ${p.cancelUrl}

— ${p.orgName}`;

  return { subject, html, text };
}

interface InvitationEmailProps {
  inviteeName?: string | null;
  orgName: string;
  inviterName?: string | null;
  acceptUrl: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'administradora',
  professional: 'profesional',
  receptionist: 'recepcionista',
};

export function invitationEmail(p: InvitationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  // Subject sin emojis (los filtros de spam castigan emojis en subject) y sin
  // caracteres tipo "¡!" que disparan alertas. Concreto + nombre de la org
  // hace que el destinatario lo reconozca rápido.
  const subject = `${p.orgName} te invita a sumarte al equipo`;
  const roleLabel = ROLE_LABELS[p.role] ?? p.role;
  const inviterPrefix = p.inviterName ? escapeHtml(p.inviterName) + ' te' : 'Te';

  const html = `
<div style="${BASE_STYLE}">
  <h1 style="font-size: 20px; margin-bottom: 12px; color: #292524;">Sumate al equipo</h1>
  <p>Hola, ${inviterPrefix} invitó a unirte a <strong>${escapeHtml(p.orgName)}</strong> como <strong>${escapeHtml(roleLabel)}</strong>.</p>

  <div style="${CARD_STYLE}">
    <p style="margin: 0 0 8px 0; font-size: 14px;">Para aceptar la invitación, creá tu cuenta:</p>
    <p style="margin: 0;"><a href="${p.acceptUrl}" style="${BUTTON_STYLE}">Aceptar invitación</a></p>
  </div>

  <p style="font-size: 13px; color: #78716c;">
    Si el botón no funciona, copiá este link en tu navegador:<br>
    <span style="word-break: break-all; color: #44403c;">${p.acceptUrl}</span>
  </p>

  <p style="font-size: 13px; color: #78716c;">
    La invitación expira en 7 días. Si no esperabas este mensaje, podés ignorarlo.
  </p>

  <div style="${FOOTER_STYLE}">
    ${escapeHtml(p.orgName)} · appestetika · gestión para centros de estética
  </div>
</div>`.trim();

  // Versión texto detallada (los clientes de email penalizan cuando solo hay
  // HTML — un text/plain rico mejora la entrega).
  const text = `Hola,

${p.inviterName ? p.inviterName + ' te' : 'Te'} invitó a unirte a ${p.orgName} como ${roleLabel} en appestetika.

Para aceptar, creá tu cuenta usando este link:
${p.acceptUrl}

La invitación expira en 7 días. Si no esperabas este mensaje, podés ignorarlo.

— ${p.orgName}
appestetika.com`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
