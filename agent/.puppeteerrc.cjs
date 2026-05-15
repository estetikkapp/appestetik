// Forzar a Puppeteer a descargar Chromium dentro del proyecto en lugar
// de ~/.cache/puppeteer (default). Sin esto, electron-builder no incluye
// el browser en el bundle final y el agente falla al lanzar con
// ENOENT chrome.exe.
//
// Esta carpeta se incluye en `files` y `asarUnpack` de package.json.
const { join } = require('path');
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
