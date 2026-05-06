/**
 * Test endpoint para diagnosticar conectividad con Evolution API.
 * Auth: requiere user logueado + role owner/admin.
 *
 * Diferente del endpoint debug (que usaba CRON_SECRET) porque éste lo invoca
 * el panel desde el dashboard como botón "Probar conexión".
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { pingEvolution } from '@/lib/integrations/whatsapp/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

  const { data: m } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('active', true)
    .single();

  if (!m || !['owner', 'admin'].includes(m.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const start = Date.now();
  const result = await pingEvolution();
  const elapsed_ms = Date.now() - start;

  const url = process.env.EVOLUTION_API_URL ?? null;
  const has_key = !!process.env.EVOLUTION_API_KEY;

  return NextResponse.json({
    ...result,
    elapsed_ms,
    config: {
      url_present: !!url,
      // No exponemos la URL completa por privacidad — solo el host
      url_host: url ? safeHost(url) : null,
      key_present: has_key,
    },
    hints: buildHints(result, url),
  });
}

function safeHost(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return u.split('/').slice(0, 3).join('/');
  }
}

function buildHints(
  result: Awaited<ReturnType<typeof pingEvolution>>,
  url: string | null
): string[] {
  const hints: string[] = [];

  if (!url) {
    hints.push('Cargá EVOLUTION_API_URL en Vercel → Settings → Environment Variables.');
    return hints;
  }

  // Detectar IPv6 sin IPv4 / sin domain
  if (/\[[0-9a-f:]+\]/i.test(url)) {
    hints.push(
      'La URL apunta a una dirección IPv6 directa. Vercel no siempre puede salir por IPv6 — pedí al admin del VPS que use IPv4 o configure un dominio (ej. evolution.tudominio.com).'
    );
  }

  if (url.startsWith('http://')) {
    hints.push(
      'La URL usa HTTP (no HTTPS). Funciona pero es inseguro: la API key viaja en texto plano. Recomendado: pedir certificado Let\'s Encrypt en el VPS y cambiar a https://.'
    );
  }

  if (!result.ok) {
    if (result.code === 'timeout') {
      hints.push(
        'El servidor no respondió en 8 segundos. Probablemente está caído o no es alcanzable desde Internet. Probá en el VPS: `systemctl status evolution-api` y `curl http://localhost:8080/instance/fetchInstances`.'
      );
    }
    if (result.code === 'network') {
      hints.push(
        'No hay ruta de red entre Vercel y el VPS. Si la URL es IPv6, intenta con IPv4 o dominio. Si tiene firewall, asegurate que el puerto esté abierto al mundo.'
      );
    }
    if (result.code === 'unauthorized') {
      hints.push(
        'La API key fue rechazada. Comparala con la del archivo .env del VPS (debería coincidir exactamente).'
      );
    }
    if (result.code === 'not_found') {
      hints.push(
        'El endpoint /instance/fetchInstances devuelve 404. Tu Evolution API puede ser una versión antigua (v1) — habría que migrar a v2 o adaptar las rutas.'
      );
    }
  } else {
    hints.push(
      `Servidor responde OK · ${result.instances} instancias activas. La conexión está bien.`
    );
  }

  return hints;
}
