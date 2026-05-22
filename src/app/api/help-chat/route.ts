/**
 * POST /api/help-chat
 *
 * Chat de ayuda IA streaming. Rate limit: 30 mensajes/hora por user.
 *
 * Body JSON: { message: string }
 * Response: text/event-stream con chunks de texto plano (sin SSE wrapper —
 * el client lee `response.body` como ReadableStream directamente).
 *
 * GET /api/help-chat (no implementado acá, ver /api/help-chat/history para
 * cargar historial previo del user al abrir el chat).
 */

import { type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { streamHelpResponse, type HelpChatMessage } from '@/lib/integrations/claude/help-chat';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RATE_LIMIT_PER_HOUR = 30;

export async function POST(req: NextRequest) {
  const { userId, orgId } = await requireMembership();

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMessage = String(body?.message ?? '').trim();
  if (!userMessage) {
    return new Response(JSON.stringify({ error: 'message vacío' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (userMessage.length > 2000) {
    return new Response(JSON.stringify({ error: 'mensaje muy largo (máx 2000)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createAdminClient();

  // Rate limit: contar msgs del user (role=user) en la última hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('help_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', oneHourAgo);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return new Response(
      JSON.stringify({
        error: `Llegaste al límite de ${RATE_LIMIT_PER_HOUR} mensajes por hora. Volvé a intentar en un rato.`,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Cargar historial reciente (últimos 20 mensajes alternados) para contexto
  const { data: historyRows } = await admin
    .from('help_chat_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  const history: HelpChatMessage[] = (historyRows ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Insertar mensaje del user inmediatamente (así si la respuesta del bot falla
  // igual queda el rastro y no se gastan slots de rate limit innecesarios)
  await admin.from('help_chat_messages').insert({
    user_id: userId,
    organization_id: orgId,
    role: 'user',
    content: userMessage,
  });

  // Stream
  let claudeStream;
  try {
    claudeStream = await streamHelpResponse({ history, userMessage });
  } catch (err) {
    console.error('[help-chat] claude error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Error de IA',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of claudeStream.stream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error('[help-chat] stream error:', err);
        controller.enqueue(encoder.encode('\n\n[Error: la respuesta se cortó.]'));
      } finally {
        controller.close();
        // Persistir la respuesta completa (fire-and-forget)
        const final = claudeStream.finalText();
        const tokens = claudeStream.tokensUsed();
        if (final) {
          void admin
            .from('help_chat_messages')
            .insert({
              user_id: userId,
              organization_id: orgId,
              role: 'assistant',
              content: final,
              tokens_used: tokens || null,
            })
            .then(({ error }) => {
              if (error) console.warn('[help-chat] persist assistant fail:', error);
            });
        }
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
}
