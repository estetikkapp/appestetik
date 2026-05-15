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

// CRÍTICO: setear PUPPETEER_CACHE_DIR ANTES de require('whatsapp-web.js')
// para que puppeteer encuentre el Chromium bundled. En dev apunta a
// agent/.cache/puppeteer (donde lo bajó npm install via .puppeteerrc.cjs).
// En prod (packaged), apunta a app.asar.unpacked/.cache/puppeteer (donde
// quedó después del unpack del asar).
const isPackaged = app?.isPackaged ?? false;
const puppeteerCacheDir = isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', '.cache', 'puppeteer')
  : path.join(__dirname, '..', '.cache', 'puppeteer');
process.env.PUPPETEER_CACHE_DIR = puppeteerCacheDir;

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const logger = require('./logger');

logger.info(`PUPPETEER_CACHE_DIR = ${puppeteerCacheDir} (exists: ${fs.existsSync(puppeteerCacheDir)})`);

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

  // Fallback: usar el Chromium bundled de puppeteer. Lo buscamos manualmente
  // dentro del cache local — más confiable que delegar en wwebjs (que en
  // versiones nuevas asume que existe pero no siempre lo encuentra).
  try {
    const chromeFolders = fs.readdirSync(path.join(puppeteerCacheDir, 'chrome'));
    for (const folder of chromeFolders) {
      const chromePath =
        process.platform === 'win32'
          ? path.join(puppeteerCacheDir, 'chrome', folder, 'chrome-win64', 'chrome.exe')
          : process.platform === 'darwin'
            ? path.join(
                puppeteerCacheDir,
                'chrome',
                folder,
                'chrome-mac-' + (process.arch === 'arm64' ? 'arm64' : 'x64'),
                'Google Chrome for Testing.app',
                'Contents',
                'MacOS',
                'Google Chrome for Testing'
              )
            : path.join(puppeteerCacheDir, 'chrome', folder, 'chrome-linux64', 'chrome');
      if (fs.existsSync(chromePath)) {
        logger.info(`Chromium bundled encontrado: ${chromePath}`);
        return chromePath;
      }
    }
  } catch (err) {
    logger.warn(`No se pudo leer cache de puppeteer (${puppeteerCacheDir}): ${err.message}`);
  }

  logger.warn(
    'Chrome del sistema NO encontrado y Chromium bundled tampoco — el cliente fallará. ' +
      'Esto no debería pasar en builds release: revisar que .cache/puppeteer esté incluido en el paquete.'
  );
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

  // wwebjs a veces emite 'ready' antes de que client.info esté populado.
  // Reintentamos hasta 10s con backoff de 500ms.
  let phone = null;
  for (let i = 0; i < 20; i++) {
    try {
      const info = client?.info;
      if (info?.wid?.user) {
        phone = `+${info.wid.user}`;
        break;
      }
    } catch (err) {
      logger.warn(`getPhone intento ${i + 1} error: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!phone) {
    logger.warn('No se pudo obtener phone después de 10s — reportando ready sin número');
  }
  currentPhone = phone;
  logger.info(`Conectado a WhatsApp${phone ? ` con ${phone}` : ' (sin phone)'} (via ${source})`);
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
      // Antes de emitir ready, verificar que window.WWebJS este inyectado.
      // El watchdog forzaba ready demasiado temprano cuando getState era
      // CONNECTED pero los scripts internos no estaban listos -> primer
      // sendMessage explotaba con "Cannot read properties of undefined
      // (reading 'getChat')".
      const wwebjsReady = await waitForWWebJSReady(2_000);
      if (!wwebjsReady) {
        logger.info(`watchdog tick ${ticks} — CONNECTED pero window.WWebJS aun no listo`);
        return; // no detener watchdog, seguir esperando
      }
      stopPostAuthWatchdog();
      await emitReady('watchdog getState=CONNECTED+WWebJS_ready');
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
      // Sin webVersionCache manual: whatsapp-web.js >=1.30 detecta y maneja
      // la versión actual de WA Web automáticamente. El pin manual era un
      // workaround para 1.26 (selectores hardcodeados). Pinear ahora a una
      // versión específica además rompe (TypeError 'markedUnread') porque
      // wwebjs nuevo espera selectores de la versión que WA esté sirviendo.
      // Si WhatsApp introduce cambios breaking, bumpear wwebjs antes de
      // volver a tocar este cache.
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

    // Timeout de seguridad: si initialize() no resuelve en 90s (browser colgado,
    // webVersionCache 404, antivirus bloqueando Chromium, etc.) forzamos
    // reconexión. Sin esto el cliente queda eterno en 'starting' sin error.
    const INIT_TIMEOUT_MS = 90_000;
    let initTimedOut = false;
    const initTimeout = setTimeout(() => {
      initTimedOut = true;
      logger.error(`initialize() no respondió en ${INIT_TIMEOUT_MS / 1000}s — forzando reconexión`);
      scheduleReconnect('init_timeout', 10);
    }, INIT_TIMEOUT_MS);

    client
      .initialize()
      .then(() => {
        clearTimeout(initTimeout);
        if (!initTimedOut) {
          logger.info('whatsapp-web.js client inicializado, esperando QR/auth...');
        }
      })
      .catch((err) => {
        clearTimeout(initTimeout);
        if (initTimedOut) return;
        logger.error('initialize error:', err.message);
        scheduleReconnect('init_error', 5);
      });
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

// Espera hasta `timeoutMs` a que window.WWebJS esté inyectado en la página
// con sus métodos críticos disponibles. Sin esto, sendMessage tira
// "Cannot read properties of undefined (reading 'getChat')" porque el
// watchdog emitió ready antes de que los scripts internos terminen de
// cargarse.
async function waitForWWebJSReady(timeoutMs = 30_000) {
  if (!client?.pupPage) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ready = await client.pupPage.evaluate(() => {
        return (
          typeof window !== 'undefined' &&
          typeof window.WWebJS === 'object' &&
          window.WWebJS !== null &&
          typeof window.WWebJS.getChat === 'function' &&
          typeof window.WWebJS.sendMessage === 'function'
        );
      });
      if (ready) return true;
    } catch {
      // pupPage puede haber muerto entre evaluaciones; esperamos y reintentamos
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function sendText(to, text) {
  if (!client || status !== 'ready') {
    throw new Error(`WhatsApp no listo (status: ${status})`);
  }
  const digits = String(to).replace(/\D/g, '');
  if (digits.length < 8) {
    throw new Error(`Número inválido: ${to}`);
  }

  // Esperar a que wwebjs esté completamente cargado en la pagina antes
  // de tocar getNumberId/sendMessage.
  const wwebjsReady = await waitForWWebJSReady(30_000);
  if (!wwebjsReady) {
    throw new Error('window.WWebJS no inicializado tras 30s — wwebjs incompatible con WA Web actual');
  }

  // CRÍTICO: WhatsApp NO devuelve error si mandás a un JID que no existe.
  // El mensaje cae al vacío y "todo OK". Verificamos primero con
  // getNumberId() que además resuelve el formato Argentina (+549 vs +54)
  // automáticamente — WhatsApp nos devuelve el JID canónico.
  let numberId;
  try {
    numberId = await client.getNumberId(digits);
  } catch (err) {
    throw new Error(`Error verificando número ${to}: ${err.message}`);
  }
  if (!numberId) {
    throw new Error(`El número ${to} no está registrado en WhatsApp`);
  }

  // Reintentos en errores transitorios de wwebjs (getChat undefined,
  // markedUnread undefined). Pasan cuando los scripts internos de WA Web
  // están a medio cargar. Con espera entre intentos suele resolverse.
  const TRANSIENT = /(getChat|markedUnread|Cannot read properties of undefined)/i;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await client.sendMessage(numberId._serialized, text);
      return;
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      if (!TRANSIENT.test(msg)) throw err;
      logger.warn(`sendMessage intento ${attempt + 1} fallo (${msg.slice(0, 80)}) — reintento en 3s`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
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
