/**
 * Bridge polling endpoint.
 *
 * El agente local llama acá cada 3-5s con su Bearer token. Server:
 *   1. Autentica el token → resuelve org_id
 *   2. Marca expired los commands cuyo expires_at pasó
 *   3. Toma los pendientes de esta org (max 5 por poll), marca como 'processing'
 *   4. Los devuelve al bridge para ejecución
 *   5. Acepta también body { heartbeat: { status, agent_version, agent_os } } para actualizar bridge_state
 *
 * Bridge respond con /api/bridge/result cuando termina cada comando.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateBridge } from '@/lib/bridge/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COMMANDS_PER_POLL = 5;

export async function POST(req: NextRequest) {
  const auth = await authenticateBridge(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let heartbeat: {
    status?: 'starting' | 'qr_pending' | 'connecting' | 'ready' | 'disconnected';
    agent_version?: string;
    agent_os?: string;
  } = {};
  try {
    const body = (await req.json()) as { heartbeat?: typeof heartbeat };
    heartbeat = body.heartbeat ?? {};
  } catch {
    // body opcional, no problem
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Upsert bridge_state con el heartbeat
  await admin
    .from('bridge_state')
    .upsert({
      bridge_token_id: auth.tokenId,
      last_heartbeat_at: nowIso,
      updated_at: nowIso,
      ...(heartbeat.status ? { status: heartbeat.status } : {}),
      ...(heartbeat.agent_version ? { agent_version: heartbeat.agent_version } : {}),
      ...(heartbeat.agent_os ? { agent_os: heartbeat.agent_os } : {}),
    });

  // Sincronizar org.whatsapp_status con el heartbeat. Necesario porque
  // /api/bridge/connected puede no haber llegado nunca (ej: el agente
  // reportó phone_e164=null y la versión vieja del endpoint rechazaba).
  // Sin este sync, lib/reminders.ts ve whatsapp_status='disconnected'
  // y no encola comandos, aunque el bridge esté operativo.
  if (heartbeat.status === 'ready') {
    await admin
      .from('organizations')
      .update({
        whatsapp_status: 'connected',
        whatsapp_provider: 'local_bridge',
      })
      .eq('id', auth.organizationId)
      .neq('whatsapp_status', 'connected'); // evita writes inutiles
  } else if (heartbeat.status === 'disconnected') {
    await admin
      .from('organizations')
      .update({ whatsapp_status: 'disconnected' })
      .eq('id', auth.organizationId)
      .neq('whatsapp_status', 'disconnected');
  }

  // Expirar comandos viejos antes de tomar nuevos
  await admin
    .from('bridge_commands')
    .update({ status: 'expired' })
    .eq('organization_id', auth.organizationId)
    .eq('status', 'pending')
    .lt('expires_at', nowIso);

  // Tomar los pendientes (FIFO) y marcarlos como 'processing'
  const { data: pending } = await admin
    .from('bridge_commands')
    .select('id, action, payload, attempts')
    .eq('organization_id', auth.organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_COMMANDS_PER_POLL);

  const commands = pending ?? [];
  if (commands.length > 0) {
    const ids = commands.map((c) => c.id);
    await admin
      .from('bridge_commands')
      .update({
        status: 'processing',
        bridge_token_id: auth.tokenId,
        attempts: commands[0]?.attempts ? commands[0].attempts + 1 : 1,
      })
      .in('id', ids);
  }

  return NextResponse.json({
    commands: commands.map((c) => ({
      id: c.id,
      action: c.action,
      payload: c.payload,
    })),
    server_time: nowIso,
  });
}
