// Electron main process.
//
// Responsabilidades:
//   1. Crear ventana de UI (renderer) para configuración + estado
//   2. Tray icon (icon en la barra de tareas con menú contextual)
//   3. Auto-start con el SO
//   4. Spawning del cliente whatsapp-web.js (corre en mismo proceso main)
//   5. Auto-updater check via electron-updater (GitHub Releases)
//   6. IPC: pasa eventos del cliente WhatsApp ↔ renderer

const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const store = require('./store');
const wa = require('./whatsapp');
const api = require('./api-client');
const logger = require('./logger');

// Single instance lock — si el user abre la app dos veces, foco la primera
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let pollInterval = null;
let lastReportedQr = null;
let lastReportedPhone = null;
let lastReportedStatus = null;

// ── Tray menu ────────────────────────────────────────────────────────────
function buildTrayMenu() {
  const status = wa.getCurrentStatus();
  return Menu.buildFromTemplate([
    { label: `Estado: ${formatStatus(status)}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Mostrar ventana',
      click: () => {
        if (mainWindow) mainWindow.show();
      },
    },
    {
      label: 'Abrir appestetika.com',
      click: () => shell.openExternal(getAppUrl() + '/configuracion'),
    },
    { type: 'separator' },
    {
      label: 'Salir (los recordatorios dejan de funcionar)',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
}

function formatStatus(s) {
  switch (s) {
    case 'ready':
      return 'Conectado';
    case 'qr_pending':
      return 'Esperando QR scan';
    case 'connecting':
      return 'Conectando';
    case 'starting':
      return 'Arrancando';
    case 'loading':
      return 'Cargando WhatsApp';
    case 'disconnected':
      return 'Desconectado';
    default:
      return s || 'inicializando';
  }
}

function getAppUrl() {
  return store.get('appUrl') || process.env.APPESTETIKA_URL || 'https://estetikkapp.com';
}

function updateTray() {
  if (!tray) return;
  const status = wa.getCurrentStatus();
  tray.setToolTip(`appestetika bridge — ${formatStatus(status)}`);
  tray.setContextMenu(buildTrayMenu());
}

// ── Window ───────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 700,
    minWidth: 480,
    minHeight: 600,
    title: 'appestetika bridge',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // Si no hay token configurado, mostrar la ventana; si está todo OK,
    // dejarla oculta (la app vive en tray).
    if (!store.get('bridgeToken')) {
      mainWindow.show();
    }
  });

  // Close (X) → solo esconde, no cierra (la app sigue en tray)
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Polling loop ─────────────────────────────────────────────────────────
async function pollOnce() {
  const token = store.get('bridgeToken');
  if (!token) return;

  const heartbeat = {
    status: wa.getCurrentStatus(),
    agent_version: app.getVersion(),
    agent_os: `${process.platform}-${process.arch}`,
  };

  try {
    const res = await api.poll(token, heartbeat);
    if (res?.commands?.length) {
      for (const cmd of res.commands) {
        await handleCommand(token, cmd);
      }
    }
  } catch (err) {
    logger.warn('poll error:', err.message);
    // Si es 401, el token fue revocado o no existe
    if (err.message?.includes('401')) {
      sendToRenderer('token-invalid');
    }
  }
}

async function handleCommand(token, cmd) {
  let ok = false;
  let error = null;
  try {
    if (cmd.action === 'send_text') {
      const { to, text } = cmd.payload;
      await wa.sendText(to, text);
      ok = true;
    } else {
      error = `Acción desconocida: ${cmd.action}`;
    }
  } catch (err) {
    error = err.message || String(err);
  }
  try {
    await api.reportResult(token, cmd.id, ok, error);
  } catch (err) {
    logger.warn(`Error reporting result ${cmd.id}:`, err.message);
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(pollOnce, 3000);
  pollOnce();
}

// ── WhatsApp event handlers ─────────────────────────────────────────────
async function onWhatsappEvent(event, payload) {
  const token = store.get('bridgeToken');
  if (!token) return;
  updateTray();
  sendToRenderer('wa-event', { event, payload });

  if (event === 'qr') {
    if (payload === lastReportedQr) return;
    lastReportedQr = payload;
    lastReportedPhone = null;
    try {
      await api.reportQr(token, payload);
    } catch (err) {
      logger.warn('reportQr failed:', err.message);
    }
  } else if (event === 'ready') {
    const phone = payload.phone;
    if (phone && phone === lastReportedPhone) return;
    lastReportedPhone = phone;
    lastReportedQr = null;
    try {
      await api.reportConnected(token, phone);
    } catch (err) {
      logger.warn('reportConnected failed:', err.message);
    }
  } else if (event === 'disconnected') {
    if (lastReportedStatus === 'disconnected') return;
    lastReportedStatus = 'disconnected';
    lastReportedPhone = null;
    try {
      await api.reportDisconnected(token, payload.reason);
    } catch (err) {
      logger.warn('reportDisconnected failed:', err.message);
    }
  }

  lastReportedStatus = wa.getCurrentStatus();
}

// ── IPC desde renderer ───────────────────────────────────────────────────
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

ipcMain.handle('get-config', () => {
  return {
    bridgeToken: store.get('bridgeToken') ? '***configured***' : null,
    appUrl: getAppUrl(),
    autoStart: app.getLoginItemSettings().openAtLogin,
    version: app.getVersion(),
  };
});

ipcMain.handle('set-token', async (_event, token) => {
  if (!token || typeof token !== 'string' || !token.startsWith('abp_')) {
    return { ok: false, error: 'Formato de código inválido — empieza con abp_' };
  }
  // Test the token by trying to poll once
  try {
    await api.poll(token.trim(), { status: 'starting', agent_version: app.getVersion() });
  } catch (err) {
    return { ok: false, error: `No se pudo validar el código: ${err.message}` };
  }
  const previousToken = store.get('bridgeToken');
  const newToken = token.trim();
  // Si cambió el token (nueva vinculación), borramos la sesión de WhatsApp
  // anterior para forzar un re-escaneo de QR. Sin esto, una sesión persistida
  // a medias puede dejar la app pegada en "Conectando" sin mostrar QR.
  if (previousToken && previousToken !== newToken) {
    await wa.stop();
    wa.clearAuth();
  }
  store.set('bridgeToken', newToken);
  // Reiniciar polling + WhatsApp con el nuevo token
  startPolling();
  if (!wa.isRunning()) {
    wa.start(onWhatsappEvent);
  }
  return { ok: true };
});

ipcMain.handle('reset', async () => {
  store.delete('bridgeToken');
  await wa.stop();
  // Limpiar la sesión local de WhatsApp tambien — sin esto, al pegar un token
  // nuevo el agente intenta restaurar la sesión vieja y queda colgado.
  wa.clearAuth();
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
  lastReportedQr = null;
  lastReportedPhone = null;
  lastReportedStatus = null;
  return { ok: true };
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { ok: false, error: 'Updates solo funcionan en builds instalados (no en modo dev)' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, hasUpdate: Boolean(result?.updateInfo?.version && result.updateInfo.version !== app.getVersion()), version: result?.updateInfo?.version ?? null };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

ipcMain.handle('open-log-folder', () => {
  const p = logger.getLogFilePath();
  if (p) shell.showItemInFolder(p);
  return { ok: true, path: p };
});

ipcMain.handle('rescan-qr', async () => {
  // Borra la sesión local de WhatsApp y reinicia el cliente. El token queda
  // intacto. Útil cuando la sesión persistida se rompió y la UI queda pegada.
  await wa.stop();
  wa.clearAuth();
  lastReportedQr = null;
  lastReportedPhone = null;
  lastReportedStatus = null;
  if (store.get('bridgeToken')) {
    wa.start(onWhatsappEvent);
  }
  return { ok: true };
});

ipcMain.handle('set-app-url', (_event, url) => {
  if (!url || !url.startsWith('http')) return { ok: false };
  store.set('appUrl', url.replace(/\/$/, ''));
  return { ok: true };
});

ipcMain.handle('toggle-auto-start', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  return { ok: true };
});

ipcMain.handle('get-current-status', () => {
  return {
    waStatus: wa.getCurrentStatus(),
    qr: wa.getCurrentQr(),
    phone: wa.getCurrentPhone(),
  };
});

// ── App lifecycle ────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Tray icon
  const trayIconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const trayIcon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  tray.setToolTip('appestetika bridge');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else mainWindow.show();
    }
  });

  createWindow();

  // Si ya hay token, arrancamos WhatsApp + polling en background
  if (store.get('bridgeToken')) {
    wa.start(onWhatsappEvent);
    startPolling();
  }

  // Auto-updater (check cada 6 horas)
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.on('checking-for-update', () => sendToRenderer('update-status', { status: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      sendToRenderer('update-status', { status: 'available', version: info.version })
    );
    autoUpdater.on('update-not-available', () => sendToRenderer('update-status', { status: 'not-available' }));
    autoUpdater.on('download-progress', (p) =>
      sendToRenderer('update-status', { status: 'downloading', percent: Math.round(p.percent) })
    );
    autoUpdater.on('update-downloaded', (info) =>
      sendToRenderer('update-status', { status: 'downloaded', version: info.version })
    );
    autoUpdater.on('error', (err) =>
      sendToRenderer('update-status', { status: 'error', error: err.message })
    );

    autoUpdater.checkForUpdates().catch((err) =>
      logger.warn('auto-update check failed:', err.message)
    );
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 6 * 60 * 60 * 1000);
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', (event) => {
  // No salimos al cerrar todas las ventanas — vivimos en tray
  event.preventDefault();
});

app.on('before-quit', async () => {
  app.isQuiting = true;
  if (pollInterval) clearInterval(pollInterval);
  try {
    await wa.stop();
  } catch {}
});

process.on('unhandledRejection', (err) => logger.warn('unhandledRejection:', err?.message || err));
process.on('uncaughtException', (err) => logger.warn('uncaughtException:', err?.message || err));
