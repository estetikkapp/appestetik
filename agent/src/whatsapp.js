// Wrapper alrededor de @whiskeysockets/baileys.
//
// Por qué Baileys y no whatsapp-web.js: wwebjs usa Puppeteer + WhatsApp Web
// (browser headless con scripts inyectados) que se rompe cada vez que Meta
// cambia el HTML de WA Web. Baileys habla el protocolo Multi-Device
// nativo via WebSocket — sin browser, sin scripts inyectados, sin
// dependencias frágiles. Como corre desde la PC del consultorio (IP
// residencial), Meta no la bloquea como hace con datacenters.
//
// Events emitidos (callback signature: (eventName, payload)):
//   - 'starting'      → cliente arrancado, esperando QR/auth
//   - 'qr'            → string base64 de la imagen del QR (data URL)
//   - 'connecting'    → autenticado, abriendo socket
//   - 'loading'       → durante reconexión, payload = { percent, message }
//   - 'ready'         → conectado, payload = { phone: '+5491155551234' }
//   - 'disconnected'  → payload = { reason }
//
// API publica (consumida por main.js — NO romper el contrato):
//   start(onEvent)
//   stop()
//   clearAuth()
//   isRunning()
//   sendText(to, text)
//   getCurrentStatus()
//   getCurrentQr()
//   getCurrentPhone()

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const QRCode = require('qrcode');
const pino = require('pino');
const logger = require('./logger');

// Baileys es ESM-friendly via require('default'). El export default es
// makeWASocket; los named exports estan en el mismo modulo.
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');

// Boom errors expone .output.statusCode para identificar motivo de cierre.
let sock = null;
let eventCallback = null;
let status = 'starting';
let currentQrDataUrl = null;
let currentPhone = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let saveCredsFn = null;
let stopping = false;

// Path para guardar credenciales de la sesion (multi-file = un dir con
// pre-keys, sender keys, etc). Persiste entre reinicios.
function getAuthPath() {
  const userData = app?.getPath?.('userData') || path.join(process.cwd(), '.baileys_auth');
  return path.join(userData, '.baileys_auth');
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

function scheduleReconnect(reason, baseSeconds = 5) {
  if (reconnectTimer || stopping) return;
  reconnectAttempts++;
  const delay = Math.min(baseSeconds * Math.pow(2, Math.min(reconnectAttempts - 1, 4)), 60);
  logger.warn(`Reconectando en ${delay}s (motivo: ${reason}, intento ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initSock();
  }, delay * 1000);
}

async function initSock() {
  try {
    setStatus('starting');
    emit('starting');

    // Cerrar socket anterior si quedo (paranoia)
    if (sock) {
      try {
        sock.end?.(undefined);
      } catch {}
      sock = null;
    }

    const authPath = getAuthPath();
    fs.mkdirSync(authPath, { recursive: true });

    // useMultiFileAuthState devuelve state (creds + signal store) y
    // saveCreds, una funcion que llamamos cada vez que las credenciales
    // se actualizan (handshake, encryption keys, etc).
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    saveCredsFn = saveCreds;

    // Pinear a la latest WA Web version conocida por Baileys. Baileys
    // mantiene esto actualizado; sin esto puede usar una version vieja
    // que WA cierra inmediatamente.
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307],
    }));
    logger.info(`Baileys version WA Web: ${version.join('.')}`);

    sock = makeWASocket({
      version,
      auth: state,
      // Logger silencioso — Baileys es muy verboso, no nos sirve en prod
      logger: pino({ level: 'silent' }),
      // El identificador que aparece en "Dispositivos vinculados" del celu
      browser: Browsers.appropriate('Desktop'),
      // No imprimir QR en stdout (lo manejamos manualmente)
      printQRInTerminal: false,
      // Sincronizar historial completo es lento e innecesario para enviar
      syncFullHistory: false,
      // Generar high-quality link previews (off por perf)
      generateHighQualityLinkPreview: false,
      // Para envios sin marcar al destinatario online de mas
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR generado (string raw que hay que renderizar como imagen)
      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
          currentQrDataUrl = dataUrl;
          currentPhone = null;
          setStatus('qr_pending');
          emit('qr', dataUrl);
        } catch (err) {
          logger.warn('QR encode error:', err.message);
        }
      }

      if (connection === 'connecting') {
        setStatus('connecting');
        emit('connecting');
      } else if (connection === 'open') {
        // Conectado! Capturar el numero del usuario.
        reconnectAttempts = 0;
        currentQrDataUrl = null;
        setStatus('ready');

        // sock.user.id viene como '5491155551234:25@s.whatsapp.net'.
        // El primer segmento antes de ':' es el número (puede traer suffix
        // numerico de device id).
        let phone = null;
        try {
          const id = sock.user?.id;
          if (id) {
            const numPart = id.split('@')[0].split(':')[0];
            if (numPart) phone = `+${numPart}`;
          }
        } catch (err) {
          logger.warn('No se pudo extraer phone:', err.message);
        }
        currentPhone = phone;
        logger.info(`Conectado a WhatsApp${phone ? ` con ${phone}` : ' (sin phone)'}`);
        emit('ready', { phone });
      } else if (connection === 'close') {
        const errCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || `code:${errCode}`;
        logger.warn(`disconnected: ${reason}`);
        setStatus('disconnected');
        currentPhone = null;
        emit('disconnected', { reason });

        if (stopping) return;

        // loggedOut = la sesion fue cerrada desde el celular.
        // Limpiar auth y arrancar de cero (mostrara QR fresco).
        if (errCode === DisconnectReason.loggedOut) {
          logger.info('Sesion cerrada desde celular, limpiando auth');
          try {
            fs.rmSync(authPath, { recursive: true, force: true });
          } catch {}
          reconnectAttempts = 0;
          scheduleReconnect('logged_out', 3);
          return;
        }

        // Otros casos: reconectar con backoff
        scheduleReconnect(reason, 5);
      }
    });

    logger.info('Baileys socket inicializado, esperando QR/auth...');
  } catch (err) {
    logger.error('initSock exception:', err.message);
    scheduleReconnect('init_exception', 5);
  }
}

// ── API publica ──────────────────────────────────────────────────────────
function start(onEvent) {
  eventCallback = onEvent;
  stopping = false;
  initSock();
}

async function stop() {
  stopping = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      sock.end?.(undefined);
    } catch {}
    sock = null;
  }
  setStatus('disconnected');
  currentQrDataUrl = null;
  currentPhone = null;
  reconnectAttempts = 0;
}

// Borra la sesion local. Necesario al desvincular o cuando el user quiere
// re-escanear el QR.
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
  return sock !== null;
}

// Manda un mensaje de texto. Verifica que el numero exista en WhatsApp
// antes de enviar — sino, Baileys acepta cualquier JID y el mensaje cae
// al vacio sin error.
async function sendText(to, text) {
  if (!sock || status !== 'ready') {
    throw new Error(`WhatsApp no listo (status: ${status})`);
  }
  const digits = String(to).replace(/\D/g, '');
  if (digits.length < 8) {
    throw new Error(`Número inválido: ${to}`);
  }

  // onWhatsApp acepta el numero con o sin '+', resuelve a JID canonico
  // (importante para Argentina: maneja +549 vs +54 automaticamente).
  let result;
  try {
    [result] = await sock.onWhatsApp(digits);
  } catch (err) {
    throw new Error(`Error verificando número ${to}: ${err.message}`);
  }
  if (!result?.exists) {
    throw new Error(`El número ${to} no está registrado en WhatsApp`);
  }
  await sock.sendMessage(result.jid, { text });
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
