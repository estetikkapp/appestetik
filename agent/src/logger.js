// Logger minimal con timestamp. Stdout + archivo (para diagnóstico en
// instalaciones del usuario donde no hay consola visible).

const fs = require('fs');
const path = require('path');

let logFilePath = null;
let logStream = null;

function ts() {
  return new Date().toISOString();
}

function ensureStream() {
  if (logStream) return logStream;
  try {
    // app no está disponible hasta que Electron arranca; el primer log
    // antes de eso solo va a stdout. Después abrimos el archivo.
    const { app } = require('electron');
    const userData = app?.getPath?.('userData');
    if (!userData) return null;
    const logsDir = path.join(userData, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, 'agent.log');
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    return logStream;
  } catch {
    return null;
  }
}

function write(level, args) {
  const line = `[${ts()}] ${level} ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}`;
  if (level === 'WARN') console.warn(line);
  else if (level === 'ERROR') console.error(line);
  else console.log(line);
  const s = ensureStream();
  if (s) s.write(line + '\n');
}

function info(...args) {
  write('INFO', args);
}

function warn(...args) {
  write('WARN', args);
}

function error(...args) {
  write('ERROR', args);
}

function getLogFilePath() {
  ensureStream();
  return logFilePath;
}

module.exports = { info, warn, error, getLogFilePath };
