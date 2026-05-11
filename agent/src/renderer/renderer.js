// Renderer process — la UI del agente. Habla con main via window.agentAPI
// (definido en preload.js).

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $('setup-screen'),
  status: $('status-screen'),
  invalid: $('invalid-screen'),
};

const els = {
  tokenInput: $('token-input'),
  tokenError: $('token-error'),
  saveTokenBtn: $('save-token-btn'),
  statusDot: $('status-dot'),
  statusText: $('status-text'),
  phoneRow: $('phone-row'),
  phoneValue: $('phone-value'),
  qrContainer: $('qr-container'),
  qrImage: $('qr-image'),
  connectingScreen: $('connecting-screen'),
  connectingText: $('connecting-text'),
  loadingProgressBar: $('loading-progress-bar'),
  loadingProgressFill: $('loading-progress-fill'),
  loadingHint: $('loading-hint'),
  readyScreen: $('ready-screen'),
  appUrl: $('app-url'),
  version: $('version'),
  footerVersion: $('footer-version'),
  autoStartToggle: $('auto-start-toggle'),
  resetBtn: $('reset-btn'),
  resetFromInvalid: $('reset-from-invalid'),
  openConfigLink: $('open-config-link'),
  openPanelLink: $('open-panel-link'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => (s.hidden = true));
  screens[name].hidden = false;
}

function setStatusUI(status, payload) {
  const labels = {
    ready: 'Conectado a WhatsApp',
    qr_pending: 'Esperando que escanees el QR',
    connecting: 'Conectando con WhatsApp',
    starting: 'Arrancando navegador',
    loading: 'Cargando WhatsApp',
    disconnected: 'Desconectado',
  };

  els.statusDot.className = 'status-dot ' + status;
  els.statusText.textContent = labels[status] || status;

  // Ocultar todo y mostrar la sección apropiada
  els.qrContainer.hidden = true;
  els.connectingScreen.hidden = true;
  els.readyScreen.hidden = true;
  els.phoneRow.hidden = true;

  if (status === 'qr_pending' && payload) {
    els.qrImage.src = payload;
    els.qrContainer.hidden = false;
  } else if (status === 'connecting' || status === 'starting' || status === 'loading') {
    els.connectingScreen.hidden = false;
    if (status === 'loading') {
      const pct = payload && typeof payload.percent === 'number' ? payload.percent : null;
      const msg = payload && payload.message ? payload.message : 'Cargando WhatsApp';
      els.connectingText.textContent = pct !== null ? `${msg} · ${pct}%` : msg;
      els.loadingHint.hidden = false;
      if (pct !== null) {
        els.loadingProgressBar.hidden = false;
        els.loadingProgressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      } else {
        els.loadingProgressBar.hidden = true;
      }
    } else {
      els.connectingText.textContent =
        status === 'starting' ? 'Arrancando navegador...' : 'Conectando con WhatsApp...';
      els.loadingProgressBar.hidden = true;
      els.loadingHint.hidden = true;
    }
  } else if (status === 'ready') {
    els.readyScreen.hidden = false;
    if (payload?.phone) {
      els.phoneValue.textContent = payload.phone;
      els.phoneRow.hidden = false;
    }
  }
}

async function refreshConfig() {
  const cfg = await window.agentAPI.getConfig();
  els.appUrl.textContent = cfg.appUrl;
  els.version.textContent = cfg.version;
  els.footerVersion.textContent = cfg.version;
  els.autoStartToggle.checked = cfg.autoStart;
  return cfg;
}

async function init() {
  const cfg = await refreshConfig();

  // Decidir pantalla inicial
  if (!cfg.bridgeToken) {
    showScreen('setup');
    els.tokenInput.focus();
  } else {
    showScreen('status');
    const current = await window.agentAPI.getStatus();
    if (current?.waStatus) {
      setStatusUI(
        current.waStatus,
        current.waStatus === 'qr_pending'
          ? current.qr
          : current.waStatus === 'ready'
            ? { phone: current.phone }
            : null
      );
    } else {
      setStatusUI('starting');
    }
  }
}

// ── Event handlers ──────────────────────────────────────────────────────
els.saveTokenBtn.addEventListener('click', async () => {
  const token = els.tokenInput.value.trim();
  if (!token) {
    els.tokenError.textContent = 'Pegá un código primero';
    els.tokenError.hidden = false;
    return;
  }
  els.saveTokenBtn.disabled = true;
  els.saveTokenBtn.textContent = 'Validando...';
  els.tokenError.hidden = true;

  const res = await window.agentAPI.setToken(token);
  els.saveTokenBtn.disabled = false;
  els.saveTokenBtn.textContent = 'Conectar';

  if (res.ok) {
    showScreen('status');
    setStatusUI('starting');
  } else {
    els.tokenError.textContent = res.error || 'No se pudo validar el código';
    els.tokenError.hidden = false;
  }
});

els.tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.saveTokenBtn.click();
});

els.resetBtn.addEventListener('click', async () => {
  if (!confirm('¿Desvincular este equipo? Los recordatorios dejarán de mandarse hasta que pegues un código nuevo.')) {
    return;
  }
  await window.agentAPI.reset();
  showScreen('setup');
  els.tokenInput.value = '';
  els.tokenInput.focus();
});

els.resetFromInvalid.addEventListener('click', async () => {
  await window.agentAPI.reset();
  showScreen('setup');
  els.tokenInput.value = '';
  els.tokenInput.focus();
});

els.autoStartToggle.addEventListener('change', async () => {
  await window.agentAPI.toggleAutoStart(els.autoStartToggle.checked);
});

const openExternal = (url) => {
  // shell.openExternal no está en preload, así que abrimos via location en una
  // nueva pestaña (Electron lo intercepta y abre en el browser default)
  window.open(url, '_blank');
};

els.openConfigLink.addEventListener('click', (e) => {
  e.preventDefault();
  refreshConfig().then((cfg) => openExternal(cfg.appUrl + '/configuracion'));
});
els.openPanelLink.addEventListener('click', (e) => {
  e.preventDefault();
  refreshConfig().then((cfg) => openExternal(cfg.appUrl + '/configuracion'));
});

// ── Subscripciones a eventos del main ────────────────────────────────────
window.agentAPI.onWaEvent(({ event, payload }) => {
  // Mapeamos eventos del WhatsApp client a updates de UI
  if (event === 'qr') {
    setStatusUI('qr_pending', payload);
  } else if (event === 'connecting') {
    setStatusUI('connecting');
  } else if (event === 'loading') {
    setStatusUI('loading', payload);
  } else if (event === 'ready') {
    setStatusUI('ready', payload);
  } else if (event === 'disconnected') {
    setStatusUI('disconnected');
  } else if (event === 'starting') {
    setStatusUI('starting');
  }
});

window.agentAPI.onTokenInvalid(() => {
  showScreen('invalid');
});

init();
