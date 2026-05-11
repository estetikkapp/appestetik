// Preload script — bridge seguro entre el renderer y el main process.
// Expone una API limitada al window con contextIsolation activo.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setToken: (token) => ipcRenderer.invoke('set-token', token),
  reset: () => ipcRenderer.invoke('reset'),
  rescanQr: () => ipcRenderer.invoke('rescan-qr'),
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
});
