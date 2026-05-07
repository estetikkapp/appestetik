/**
 * Webhook receiver para WhatsApp Cloud API (Meta).
 *
 * Meta llama a este endpoint cuando:
 * - Llega un mensaje entrante (response handling, opcional)
 * - Cambia el status de un mensaje (sent → delivered → read)
 *
 * Verificación inicial (GET): Meta hace un challenge cuando configurás el
 * webhook por primera vez. Tiene que devolver el `hub.challenge` que mandó,
 * pero solo si `hub.verify_token` matches el verify_token guardado en alguna
 * organización.
 *
 * En POST: el body trae `entry[].changes[].value` con el evento. El número
 * recipiente identifica a qué org va (vía `metadata.phone_number_id` que
 * cruzamos contra organizations.whatsapp_cloud_config).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// GET: handshake de Meta cuando configurás el webhook
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('bad request', { status: 400 });
  }

  // Buscar alguna org con ese verify_token
  const admin = createAdminClient();
  const { data } = await admin
    .from('organizations')
    .select('id, whatsapp_cloud_config')
    .eq('whatsapp_provider', 'cloud_api')
    .limit(1000); // hay pocas orgs, scan completo es OK

  const match = (data ?? []).find((o) => {
    const cfg = o.whatsapp_cloud_config as { verify_token?: string } | null;
    return cfg?.verify_token === token;
  });

  if (!match) {
    return new NextResponse('forbidden', { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// POST: eventos reales de WhatsApp
export async function POST(req: NextRequest) {
  let body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string; display_phone_number?: string };
          messages?: Array<{
            from?: string;
            id?: string;
            timestamp?: string;
            type?: string;
            text?: { body?: string };
          }>;
          statuses?: Array<{
            id?: string;
            status?: string;
            recipient_id?: string;
          }>;
        };
      }>;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignorar invalid JSON, Meta retry-loops si responde 4xx
  }

  // Procesar cada entry/change
  const admin = createAdminClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Buscar la org dueña de este phone_number_id
      const { data: orgs } = await admin
        .from('organizations')
        .select('id, name, whatsapp_cloud_config')
        .eq('whatsapp_provider', 'cloud_api');

      const org = (orgs ?? []).find((o) => {
        const cfg = o.whatsapp_cloud_config as { phone_number_id?: string } | null;
        return cfg?.phone_number_id === phoneNumberId;
      });

      if (!org) continue;

      // Mensajes entrantes — futuro: detección de comandos / autorespuesta.
      // Hoy: solo registramos cantidades para no filtrar contenido de
      // clientas a logs de Vercel. Si se necesita debugging, activar log
      // detallado vía env var WHATSAPP_DEBUG=1.
      if (value.messages && value.messages.length > 0) {
        if (process.env.WHATSAPP_DEBUG === '1') {
          for (const msg of value.messages) {
            console.log('[whatsapp/cloud-webhook] inbound msg', {
              org_id: org.id,
              from: msg.from,
              type: msg.type,
              preview: msg.text?.body?.slice(0, 50),
            });
          }
        }
      }

      // Statuses (delivered, read, failed) — útil para reportes.
      // No incluyen contenido del mensaje, así que es seguro loguear.
      if (value.statuses && value.statuses.length > 0 && process.env.WHATSAPP_DEBUG === '1') {
        for (const status of value.statuses) {
          console.log('[whatsapp/cloud-webhook] status', {
            org_id: org.id,
            message_id: status.id,
            status: status.status,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
