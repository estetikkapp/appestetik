/**
 * Abstracción de provider WhatsApp.
 *
 * 3 providers soportados:
 *  - 'evolution': Baileys via VPS Evolution API (datacenter IP → bloqueado por Meta, no anda)
 *  - 'cloud_api': Meta WhatsApp Cloud API oficial (requiere Meta Business + templates aprobados)
 *  - 'local_bridge': agente local de la clínica (whatsapp-web.js + Chrome en su PC residencial)
 *
 * Toda la app llama `sendWhatsappMessage(orgId, phone, text)`; este helper
 * resuelve el provider y rutea. evolution.ts / cloud-api.ts / bridge enqueue
 * quedan como clientes de bajo nivel.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendTextMessage as sendEvolutionText } from './evolution';
import {
  sendCloudText,
  sendCloudTemplate,
  type WhatsappCloudConfig,
} from './cloud-api';

type WhatsappProvider = 'evolution' | 'cloud_api' | 'local_bridge';

interface OrgWhatsappConfig {
  whatsapp_provider: WhatsappProvider;
  whatsapp_status: 'disconnected' | 'connecting' | 'connected';
  whatsapp_cloud_config: WhatsappCloudConfig | null;
}

async function loadOrgWhatsappConfig(orgId: string): Promise<OrgWhatsappConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('organizations')
    .select('whatsapp_provider, whatsapp_status, whatsapp_cloud_config')
    .eq('id', orgId)
    .maybeSingle();
  if (!data) return null;
  return data as unknown as OrgWhatsappConfig;
}

/**
 * Enqueue un comando en la cola del bridge local. El agente lo procesa
 * en el próximo poll (<= 3-5 segundos típico).
 */
async function enqueueBridgeCommand(
  orgId: string,
  action: 'send_text' | 'send_media',
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('bridge_commands').insert({
    organization_id: orgId,
    action,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: payload as any,
  });
  if (error) {
    throw new Error(`enqueue bridge command failed: ${error.message}`);
  }
}

/**
 * Manda un texto. Resuelve el provider según la org.
 * Throws si no está conectado o si falla. Best-effort callers deben atrapar.
 */
export async function sendWhatsappMessage(
  orgId: string,
  phoneE164: string,
  text: string
): Promise<void> {
  const cfg = await loadOrgWhatsappConfig(orgId);
  if (!cfg) throw new Error(`Org ${orgId} no encontrada`);

  if (cfg.whatsapp_status !== 'connected') {
    throw new Error('WhatsApp no conectado para esta org');
  }

  if (cfg.whatsapp_provider === 'local_bridge') {
    // Asíncrono: el bridge lo procesa cuando hace polling. Caller no espera
    // la entrega real, solo que se enqueuee correctamente.
    await enqueueBridgeCommand(orgId, 'send_text', { to: phoneE164, text });
    return;
  }

  if (cfg.whatsapp_provider === 'cloud_api') {
    if (!cfg.whatsapp_cloud_config) {
      throw new Error('whatsapp_cloud_config falta para org configurada como cloud_api');
    }
    await sendCloudText(cfg.whatsapp_cloud_config, phoneE164, text);
    return;
  }

  // Default / evolution
  await sendEvolutionText(orgId, phoneE164, text);
}

/**
 * Manda un mensaje basado en template (Cloud API). Para Evolution / local_bridge
 * no aplica template oficial — caen al fallback text plano si está dado.
 */
export async function sendWhatsappTemplate(
  orgId: string,
  phoneE164: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = [],
  fallbackText?: string
): Promise<void> {
  const cfg = await loadOrgWhatsappConfig(orgId);
  if (!cfg) throw new Error(`Org ${orgId} no encontrada`);

  if (cfg.whatsapp_status !== 'connected') {
    throw new Error('WhatsApp no conectado para esta org');
  }

  if (cfg.whatsapp_provider === 'cloud_api' && cfg.whatsapp_cloud_config) {
    await sendCloudTemplate(
      cfg.whatsapp_cloud_config,
      phoneE164,
      templateName,
      languageCode,
      bodyParams
    );
    return;
  }

  // local_bridge o evolution: fallback a texto plano
  if (fallbackText) {
    if (cfg.whatsapp_provider === 'local_bridge') {
      await enqueueBridgeCommand(orgId, 'send_text', { to: phoneE164, text: fallbackText });
    } else {
      await sendEvolutionText(orgId, phoneE164, fallbackText);
    }
    return;
  }

  throw new Error(
    `Provider ${cfg.whatsapp_provider} requiere fallbackText para enviar templates.`
  );
}

export type { WhatsappCloudConfig, WhatsappProvider };
