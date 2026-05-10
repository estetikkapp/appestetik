// Wrapper sobre electron-store para persistir config en userData dir.
//
// Locations:
//   Windows: %APPDATA%\appestetika bridge\config.json
//   macOS:   ~/Library/Application Support/appestetika bridge/config.json
//   Linux:   ~/.config/appestetika bridge/config.json
//
// Schema:
//   bridgeToken: string (plaintext del token abp_...)
//   appUrl: string (default: https://estetikkapp.com)

const Store = require('electron-store');

const store = new Store({
  name: 'config',
  schema: {
    bridgeToken: { type: 'string' },
    appUrl: { type: 'string', default: 'https://estetikkapp.com' },
  },
  // Aclarar al user dónde queda el archivo (visible en config.json)
  fileExtension: 'json',
});

module.exports = store;
