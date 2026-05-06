/**
 * Abstracción de provider WhatsApp: Evolution (Baileys) o Cloud API (Meta oficial).
 *
 * Toda la app usa `sendWhatsappMessage(orgId, phone, text)` y este helper resuelve
 * cuál provider usar según `organizations.whatsapp_provider`.
 *
 * Reemplaza llamadas directas a `sendTextMessage` de evolution.ts que ahora pasan
 * por acá. evolution.ts y cloud-api.ts quedan como clientes de bajo nivel.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendTextMessage as sendEvolutionText } from './evolution';
import {
  sendCloudText,
  sendCloudTemplate,
  type WhatsappCloudConfig,
} from './cloud-api';

interface OrgWhatsappConfig {
  whatsapp_provider: 'evolution' | 'cloud_api';
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
 * Manda un mensaje basado en template (solo Cloud API).
 * Si la org está en Evolution, esto cae al texto regular como fallback —
 * Evolution no tiene concepto de template aprobado.
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

  // Evolution fallback: mandar como texto plano si tenemos uno
  if (fallbackText) {
    await sendEvolutionText(orgId, phoneE164, fallbackText);
    return;
  }

  throw new Error(
    'Esta org usa Evolution sin fallbackText. Para mensajes con template hay que estar en Cloud API.'
  );
}

export type { WhatsappCloudConfig };
