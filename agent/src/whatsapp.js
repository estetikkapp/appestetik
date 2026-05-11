// Wrapper alrededor de whatsapp-web.js.
//
// Por qué whatsapp-web.js y no Baileys: usa Puppeteer + Chrome real, no el
// protocolo raw. WhatsApp ve un browser auténtico con TLS fingerprint normal
// de Chrome, indistinguible de un usuario humano. Combinado con la IP
// residencial de la PC de la clínica, pasa la detección anti-abuse de Meta
// que rechaza Baileys.
//
// Events emitted (callback signature: (eventName, payload)):
//   - 'starting'  → cliente arrancado, esperando QR/auth
//   - 'qr'        → string base64 de la imagen del QR (data URL)
//   - 'connecting' → autenticado, esperando "ready"
//   - 'ready'     → conectado, payload = { phone: '+5491155551234' }
//   - 'disconnected' → payload = { reason }
//
// API:
//   start(onEvent)  → arranca el cliente
//   stop()          → destroy + clear
//   sendText(to, text) → manda mensaje, throws si no está ready
//   getCurrentStatus() / getCurrentQr() / getCurrentPhone()

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const logger = require('./logger');

let client = null;
let eventCallback = null;
let status = 'starting';
let currentQrDataUrl = null;
let currentPhone = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let postAuthWatchdog = null;
let readyEmitted = false;

// Auth path en userData dir (persiste la sesión entre reinicios)
function getAuthPath() {
  const userData = app?.getPath?.('userData') || path.join(process.cwd(), '.wwebjs_auth');
  return path.join(userData, '.wwebjs_auth');
}

// Buscar Chrome del sistema. Si no está, electron usa Chromium bundled
// (igual sirve, pero el del sistema tiene mejor fingerprint).
function findChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
          path.join(process.env.PROGRAMFILES || '', 'Microsoft/Edge/Application/msedge.exe'),
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
          ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      logger.info(`Chrome encontrado: ${p}`);
      return p;
    }
  }
  logger.info('Chrome del sistema no encontrado, usando Chromium bundled de Puppeteer');
  return undefined;
}

function emit(event, payload) {
  if (eventCallback) {
    try {
      eventCallback(event, payload);
    } catch (err) {
      logger.warn('eventCallback error:', err.message);
    }
  }
}

function setStatus(s) {
  status = s;
}

async function emitReady(source) {
  if (readyEmitted) return;
  readyEmitted = true;
  reconnectAttempts = 0;
  setStatus('ready');
  currentQrDataUrl = null;

  let phone = null;
  try {
    const info = client?.info;
    if (info?.wid?.user) phone = `+${info.wid.user}`;
  } catch (err) {
    logger.warn('No se pudo obtener phone:', err.message);
  }
  currentPhone = phone;
  logger.info(`Conectado a WhatsApp${phone ? ` con ${phone}` : ''} (via ${source})`);
  emit('ready', { phone });
}

// Después de "authenticated", whatsapp-web.js debería emitir "ready" en
// <2min. Cuando se cuelga (bug conocido: cambios en WhatsApp Web rompen el
// detector interno), consultamos client.getState() directo cada 5s. Si el
// estado real es CONNECTED, emitimos ready manualmente. Si pasa 90s sin
// conexión, forzamos reconexión.
function startPostAuthWatchdog() {
  stopPostAuthWatchdog();
  const startedAt = Date.now();
  let ticks = 0;
  postAuthWatchdog = setInterval(async () => {
    ticks++;
    if (!client || readyEmitted) {
      stopPostAuthWatchdog();
      return;
    }
    let state = null;
    try {
      state = await client.getState();
    } catch (err) {
      logger.warn(`watchdog getState error (tick ${ticks}):`, err.message);
    }
    logger.info(`watchdog tick ${ticks} — state: ${state}`);
    if (state === 'CONNECTED') {
      stopPostAuthWatchdog();
      await emitReady('watchdog getState=CONNECTED');
      return;
    }
    if (Date.now() - startedAt > 90_000) {
      stopPostAuthWatchdog();
      logger.warn('Watchdog: 90s sin conectar post-auth, forzando reconexión');
      scheduleReconnect('post_auth_timeout', 3);
    }
  }, 5000);
}

function stopPostAuthWatchdog() {
  if (postAuthWatchdog) {
    clearInterval(postAuthWatchdog);
    postAuthWatchdog = null;
  }
}

function scheduleReconnect(reason, baseSeconds = 5) {
  if (reconnectTimer) return;
  reconnectAttempts++;
  const delay = Math.min(baseSeconds * Math.pow(2, Math.min(reconnectAttempts - 1, 4)), 60);
  logger.warn(`Reconectando en ${delay}s (motivo: ${reason}, intento ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initClient();
  }, delay * 1000);
}

async function initClient() {
  try {
    if (client) {
      try {
        await client.destroy();
      } catch {}
      client = null;
    }

    setStatus('starting');
    emit('starting');

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: getAuthPath() }),
      // Pin a una versión de WhatsApp Web conocida-funcional via el cache de
      // wppconnect-team. whatsapp-web.js 1.26 trae versiones hardcodeadas que
      // WhatsApp ya rompió — sin esto, post-auth se cuelga porque el HTML
      // que espera ya no matchea.
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023504787.html',
      },
      puppeteer: {
        // 'new' headless es mucho más compatible con WhatsApp Web que el viejo
        // (Chrome >=109). El viejo era detectado y rompía render post-auth.
        headless: 'new',
        executablePath: findChromePath(),
        defaultViewport: { width: 1280, height: 900 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          // Anti-detección: sin esto Meta marca al browser como automatizado y
          // rompe loaders internos silenciosamente.
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900',
          '--window-position=-2000,0',
        ],
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    client.on('qr', async (qr) => {
      try {
        // Convertir el QR string a data URL base64 PNG
        const dataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
        currentQrDataUrl = dataUrl;
        currentPhone = null;
        setStatus('qr_pending');
        emit('qr', dataUrl);
      } catch (err) {
        logger.warn('QR encode error:', err.message);
      }
    });

    client.on('authenticated', () => {
      setStatus('connecting');
      currentQrDataUrl = null;
      readyEmitted = false;
      emit('connecting');
      startPostAuthWatchdog();
    });

    // Después del auth, whatsapp-web.js descarga la historia de chats; puede
    // tardar 30s-2min. Sin este evento la UI parece colgada en "Conectando".
    client.on('loading_screen', (percent, message) => {
      const pct = Number(percent);
      emit('loading', { percent: Number.isFinite(pct) ? pct : null, message });
    });

    client.on('change_state', (state) => {
      logger.info(`WA state -> ${state}`);
    });

    client.on('auth_failure', (msg) => {
      logger.warn('auth_failure:', msg);
      scheduleReconnect('auth_failure', 10);
    });

    client.on('ready', async () => {
      stopPostAuthWatchdog();
      await emitReady('ready event');
    });

    client.on('disconnected', async (reason) => {
      logger.warn('disconnected:', reason);
      stopPostAuthWatchdog();
      setStatus('disconnected');
      const prev = client;
      client = null;
      currentPhone = null;
      try {
        if (prev) await prev.destroy();
      } catch {}
      emit('disconnected', { reason });

      if (reason === 'LOGOUT') {
        // Sesión cerrada desde el celular — borramos auth y arrancamos de cero
        try {
          fs.rmSync(getAuthPath(), { recursive: true, force: true });
        } catch {}
        reconnectAttempts = 0;
        scheduleReconnect('logged_out', 3);
      } else {
        scheduleReconnect(`disconnected: ${reason}`, 5);
      }
    });

    await client.initialize().catch((err) => {
      logger.error('initialize error:', err.message);
      scheduleReconnect('init_error', 5);
    });

    logger.info('whatsapp-web.js client inicializado, esperando QR/auth...');
  } catch (err) {
    logger.error('initClient exception:', err.message);
    scheduleReconnect('init_exception', 5);
  }
}

// ── API pública ─────────────────────────────────────────────────────────
function start(onEvent) {
  eventCallback = onEvent;
  initClient();
}

async function stop() {
  stopPostAuthWatchdog();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    try {
      await client.destroy();
    } catch {}
    client = null;
  }
  setStatus('disconnected');
  currentQrDataUrl = null;
  currentPhone = null;
  reconnectAttempts = 0;
  readyEmitted = false;
}

// Borra la sesión local de WhatsApp. Necesario cuando el user quiere re-escanear
// el QR (cambió de número, sesión corrupta, etc.) o cuando se desvincula el equipo.
function clearAuth() {
  try {
    fs.rmSync(getAuthPath(), { recursive: true, force: true });
    logger.info('Sesión local de WhatsApp borrada');
    return true;
  } catch (err) {
    logger.warn('No se pudo borrar la sesión:', err.message);
    return false;
  }
}

function isRunning() {
  return client !== null;
}

async function sendText(to, text) {
  if (!client || status !== 'ready') {
    throw new Error(`WhatsApp no listo (status: ${status})`);
  }
  // Aceptar +5491155551234 o 5491155551234 — normalizar a 5491155551234@c.us
  const digits = String(to).replace(/\D/g, '');
  if (digits.length < 8) {
    throw new Error(`Número inválido: ${to}`);
  }
  const jid = `${digits}@c.us`;
  await client.sendMessage(jid, text);
}

function getCurrentStatus() {
  return status;
}

function getCurrentQr() {
  return currentQrDataUrl;
}

function getCurrentPhone() {
  return currentPhone;
}

module.exports = {
  start,
  stop,
  clearAuth,
  isRunning,
  sendText,
  getCurrentStatus,
  getCurrentQr,
  getCurrentPhone,
};
