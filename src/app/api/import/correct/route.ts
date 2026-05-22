/**
 * POST /api/import/correct
 *
 * Recibe el ImportResult anterior + historial de chat + nuevo mensaje del
 * user, y devuelve el ImportResult actualizado + respuesta del asistente.
 *
 * Body JSON:
 * {
 *   "previousResult": ImportResult,
 *   "history": [{ role: "user" | "assistant", content: string }],
 *   "userMessage": string
 * }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { correctWithAI } from '@/lib/integrations/claude/data-importer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  await requireMembership({ minRole: 'admin' });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const previousResult = body?.previousResult;
  const history = Array.isArray(body?.history) ? body.history : [];
  const userMessage = String(body?.userMessage ?? '').trim();

  if (!previousResult || !Array.isArray(previousResult.clients)) {
    return NextResponse.json({ error: 'previousResult requerido' }, { status: 400 });
  }
  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage vacío' }, { status: 400 });
  }
  if (userMessage.length > 2000) {
    return NextResponse.json({ error: 'mensaje muy largo (máx 2000 chars)' }, { status: 400 });
  }

  try {
    const { result, assistantMessage } = await correctWithAI({
      previousResult,
      history,
      userMessage,
    });
    return NextResponse.json({ result, assistantMessage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[import/correct] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
