/**
 * GET /api/help-chat/history
 *
 * Devuelve los últimos 50 mensajes del chat del user. Se llama al abrir el
 * panel del chat para hidratar la conversación previa.
 */

import { NextResponse } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await requireMembership();
  const admin = createAdminClient();

  const { data } = await admin
    .from('help_chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  // Devolvemos en orden cronológico (oldest first) para que el chat se vea bien
  const messages = (data ?? []).reverse();

  return NextResponse.json({ messages });
}
