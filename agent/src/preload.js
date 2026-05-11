// Preload script — bridge seguro entre el renderer y el main process.
// Expone una API limitada al window con contextIsolation activo.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setToken: (token) => ipcRenderer.invoke('set-token', token),
  reset: () => ipcRenderer.invoke('reset'),
  rescanQr: () => ipcRenderer.invoke('rescan-qr'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder'),
  setAppUrl: (url) => ipcRenderer.invoke('set-app-url', url),
  toggleAutoStart: (enabled) => ipcRenderer.invoke('toggle-auto-start', enabled),
  getStatus: () => ipcRenderer.invoke('get-current-status'),

  // Eventos desde main
  onWaEvent: (callback) => {
    ipcRenderer.on('wa-event', (_event, payload) => callback(payload));
  },
  onTokenInvalid: (callback) => {
    ipcRenderer.on('token-invalid', () => callback());
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, payload) => callback(payload));
  },
});
