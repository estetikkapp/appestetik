// Logger minimal con prefix de timestamp + nivel. Va a stdout (visible con
// `npm run dev` o `--enable-logging` en builds packaged).

function ts() {
  return new Date().toISOString();
}

function info(...args) {
  console.log(`[${ts()}] INFO`, ...args);
}

function warn(...args) {
  console.warn(`[${ts()}] WARN`, ...args);
}

function error(...args) {
  console.error(`[${ts()}] ERROR`, ...args);
}

module.exports = { info, warn, error };
