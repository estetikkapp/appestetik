/**
 * Test endpoint para diagnosticar Resend.
 *
 * GET = check del dominio (no manda email): devuelve status del dominio en
 *       Resend, env vars presentes, etc.
 * POST = manda un email de prueba al user logueado (al email de su cuenta
 *        Supabase Auth). Si pasa, te llega el mail. Si falla, devuelve el
 *        error específico (api key inválida / dominio no verificado / etc).
 *
 * Auth: requiere user logueado + role owner/admin (mismo patrón que test
 * de WhatsApp). Solo dueñas/admins pueden gastar quota gratuita de Resend.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  sendEmail,
  checkResendDomain,
  type SendEmailErrorCode,
} from '@/lib/integrations/email/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureOwnerOrAdmin(): Promise<
  | { ok: true; userId: string; userEmail: string; orgId: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!user.email) {
    return {
      ok: false,
      status: 400,
      error: 'Tu cuenta no tiene email — no podemos mandarte el test.',
    };
  }

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return { ok: false, status: 400, error: 'No hay organización activa' };

  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .maybeSingle();

  if (!m || !['owner', 'admin'].includes(m.role)) {
    return { ok: false, status: 403, error: 'Solo owner/admin' };
  }
  return { ok: true, userId: user.id, userEmail: user.email, orgId };
}

export async function GET() {
  const auth = await ensureOwnerOrAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const domain = await checkResendDomain();
  return NextResponse.json({
    config: {
      api_key_present: domain.hasApiKey,
      from_email: domain.fromEmail,
      from_domain: domain.fromDomain,
    },
    domain: {
      status: domain.domainStatus ?? null,
      verified: domain.ok,
      auth_failed: domain.authFailed ?? false,
    },
    detail: domain.detail ?? null,
    hints: buildHints(domain),
  });
}

export async function POST() {
  const auth = await ensureOwnerOrAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const start = Date.now();
  const result = await sendEmail({
    to: auth.userEmail,
    subject: '✅ Test de email desde appestetika',
    html: `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #be93a8;">¡Funciona! 🎉</h2>
  <p>Si estás leyendo esto, la integración con Resend está bien configurada:</p>
  <ul>
    <li><strong>API key</strong> es válida</li>
    <li><strong>Dominio FROM</strong> está verificado</li>
    <li><strong>Entrega</strong> al destinatario funciona</li>
  </ul>
  <p>Las clientas que reserven turnos online y dejen email recibirán la confirmación con su código de seguridad. Los recordatorios automáticos también caen como fallback de WhatsApp si la org no tiene WhatsApp conectado.</p>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #888;">
    Este email fue disparado por el botón "Probar email" del panel de configuración. Podés ignorarlo.
  </p>
</div>`.trim(),
    text:
      '¡Funciona! La integración con Resend está bien. API key válida, dominio FROM verificado, entrega OK.',
    tags: [{ name: 'type', value: 'config_test' }],
  });
  const elapsed_ms = Date.now() - start;

  return NextResponse.json({
    ok: result.ok,
    sent_to: auth.userEmail,
    message_id: result.id ?? null,
    error: result.error ?? null,
    code: result.code ?? null,
    elapsed_ms,
    hints: result.ok ? [] : buildSendHints(result.code, result.error ?? ''),
  });
}

function buildHints(domain: Awaited<ReturnType<typeof checkResendDomain>>): string[] {
  const hints: string[] = [];
  if (!domain.hasApiKey) {
    hints.push(
      'Falta RESEND_API_KEY en Vercel. Crear cuenta en resend.com (gratis 3000 emails/mes), copiar la API key del dashboard y pegar en Vercel → Settings → Environment Variables.'
    );
    return hints;
  }
  if (domain.authFailed) {
    hints.push(
      'La API key fue rechazada por Resend. Probablemente revocada o mal copiada. Generá una nueva en resend.com → API Keys.'
    );
    return hints;
  }
  if (!domain.fromDomain) {
    hints.push(
      'RESEND_FROM_EMAIL está vacío o mal formado. Formato esperado: "Nombre <foo@dominio.com>".'
    );
    return hints;
  }
  if (domain.domainStatus === 'not_found') {
    hints.push(
      `El dominio ${domain.fromDomain} no está en tu cuenta de Resend. Andá a resend.com → Domains → Add Domain → ${domain.fromDomain} → seguí los pasos de DNS.`
    );
  } else if (domain.domainStatus === 'pending') {
    hints.push(
      `El dominio ${domain.fromDomain} está pendiente de verificación. Resend está chequeando los DNS records (puede tardar minutos a horas). Mientras tanto los emails fallan.`
    );
  } else if (domain.domainStatus === 'failed') {
    hints.push(
      `Resend marcó el dominio ${domain.fromDomain} como FAILED. Andá a resend.com → Domains → tu dominio y revisá los DNS records (probablemente falta SPF/DKIM/MX).`
    );
  } else if (domain.domainStatus === 'verified') {
    hints.push(
      `Dominio ${domain.fromDomain} verificado ✓. Si los emails siguen fallando, probá el botón "Enviar test" abajo para ver el error real al enviar.`
    );
  }
  return hints;
}

function buildSendHints(code: SendEmailErrorCode | undefined, errMsg: string): string[] {
  const hints: string[] = [];
  switch (code) {
    case 'no_api_key':
      hints.push('Cargar RESEND_API_KEY en Vercel.');
      break;
    case 'unauthorized':
      hints.push(
        'API key rechazada. Generá una nueva en resend.com → API Keys y actualizá la env var en Vercel.'
      );
      break;
    case 'domain_not_verified':
      hints.push(
        'El dominio del FROM no está verificado. resend.com → Domains → seguí los pasos de DNS.'
      );
      hints.push(
        'Workaround temporal: cambiar RESEND_FROM_EMAIL a "appestetika <onboarding@resend.dev>" para usar el dominio testing de Resend (solo permite mandar a tu propio email registrado).'
      );
      break;
    case 'invalid_recipient':
      hints.push(`Email destino inválido: ${errMsg}`);
      break;
    case 'rate_limited':
      hints.push('Rate limit de Resend excedido. Esperá unos minutos.');
      break;
    case 'server_error':
      hints.push('Resend está caído (5xx). Probá en unos minutos.');
      break;
    case 'network':
      hints.push('No se pudo conectar a api.resend.com. Verificá conectividad.');
      break;
    default:
      hints.push(`Error: ${errMsg}`);
  }
  return hints;
}
