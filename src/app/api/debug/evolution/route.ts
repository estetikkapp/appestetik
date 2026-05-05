// Debug endpoint — solo para verificar conectividad Vercel → Evolution API.
// Borrar despues de validar.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.EVOLUTION_API_URL ?? '';
  const key = process.env.EVOLUTION_API_KEY ?? '';

  if (!url) {
    return NextResponse.json({ error: 'EVOLUTION_API_URL no configurado' }, { status: 500 });
  }

  const start = Date.now();
  try {
    const res = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10_000),
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      elapsed_ms: elapsed,
      url_used: url,
      body_preview: text.slice(0, 200),
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    return NextResponse.json({
      ok: false,
      elapsed_ms: elapsed,
      url_used: url,
      error: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error && 'cause' in err ? String(err.cause) : null,
    });
  }
}
