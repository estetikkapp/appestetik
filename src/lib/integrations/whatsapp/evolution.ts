// Evolution API client — un servidor Evolution API aloja todas las instancias.
// Cada organización tiene su propia instancia nombrada `org-{orgId}`.
// Docs: https://doc.evolution-api.com

const BASE_URL = process.env.EVOLUTION_API_URL ?? '';
const API_KEY = process.env.EVOLUTION_API_KEY ?? '';

if (!BASE_URL && process.env.NODE_ENV === 'production') {
  console.warn('[whatsapp] EVOLUTION_API_URL no configurado');
}

function instanceName(orgId: string) {
  return `org-${orgId}`;
}

async function evoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Evolution API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function createInstance(orgId: string, webhookUrl: string) {
  return evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: instanceName(orgId),
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        enabled: true,
        url: webhookUrl,
        events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      },
    }),
  });
}

export async function getQR(orgId: string): Promise<{ base64: string } | null> {
  try {
    const data = await evoFetch(`/instance/connect/${instanceName(orgId)}`);
    return data?.base64 ? { base64: data.base64 } : null;
  } catch {
    return null;
  }
}

export type EvolutionStatus = 'open' | 'connecting' | 'close';

export async function getInstanceStatus(orgId: string): Promise<EvolutionStatus | null> {
  try {
    const data = await evoFetch(`/instance/connectionState/${instanceName(orgId)}`);
    return data?.instance?.state ?? null;
  } catch {
    return null;
  }
}

export async function deleteInstance(orgId: string) {
  try {
    await evoFetch(`/instance/delete/${instanceName(orgId)}`, { method: 'DELETE' });
  } catch {
    // Si ya no existe, no es error
  }
}

export async function sendTextMessage(orgId: string, phoneE164: string, text: string) {
  // Evolution API espera número sin + y con código de país
  const number = phoneE164.replace(/^\+/, '');
  return evoFetch(`/message/sendText/${instanceName(orgId)}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      text,
    }),
  });
}
