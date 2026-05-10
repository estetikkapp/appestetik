// Cliente HTTP minimal contra los endpoints /api/bridge/* de appestetika.
// Usa fetch global (Node 20+). Authorization: Bearer <token>.

const store = require('./store');

function getBase() {
  return store.get('appUrl') || 'https://estetikkapp.com';
}

async function request(method, path, token, body) {
  const url = `${getBase()}${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'appestetika-bridge/1.0.0',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {}
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }

  // Algunos endpoints devuelven 200 con body vacío
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// POST /api/bridge/poll — heartbeat + return pending commands
async function poll(token, heartbeat) {
  return request('POST', '/api/bridge/poll', token, { heartbeat });
}

// POST /api/bridge/result — report ack/result of a command
async function reportResult(token, id, ok, error) {
  return request('POST', '/api/bridge/result', token, { id, ok, error });
}

// POST /api/bridge/qr — push QR base64 cuando whatsapp-web lo genera
async function reportQr(token, qrBase64) {
  return request('POST', '/api/bridge/qr', token, { qr_base64: qrBase64 });
}

// POST /api/bridge/connected — whatsapp linkeado
async function reportConnected(token, phoneE164) {
  return request('POST', '/api/bridge/connected', token, { phone_e164: phoneE164 });
}

// POST /api/bridge/disconnected — perdió la sesión
async function reportDisconnected(token, reason) {
  return request('POST', '/api/bridge/disconnected', token, { reason });
}

module.exports = {
  poll,
  reportResult,
  reportQr,
  reportConnected,
  reportDisconnected,
};
