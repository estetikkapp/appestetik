# appestetika bridge

Agente de escritorio que vincula tu WhatsApp con appestetika.com para enviar
recordatorios automáticos a tus clientas.

## Cómo funciona

1. Lo instalás en la PC del consultorio (Windows, Mac o Linux)
2. Pegás un código de vinculación que generaste en appestetika.com → Configuración
3. Escaneás un QR con WhatsApp (igual que vinculás cualquier otro dispositivo)
4. Listo — el agente queda en la barra de tareas y manda los recordatorios cuando
   appestetika se lo pide

El agente corre **Chrome real** via Puppeteer cargando web.whatsapp.com. WhatsApp
no detecta nada raro porque es exactamente como si vos abrieras WhatsApp Web en
ese mismo navegador.

## Desarrollo local

```bash
npm install
npm run dev
```

Para apuntar a un servidor distinto al default:

```bash
APPESTETIKA_URL=http://localhost:3000 npm run dev
```

(o cambiarlo desde la UI del agente una vez que arranque.)

## Build

```bash
npm install
npm run build:win   # Windows .exe (NSIS installer)
npm run build:mac   # Mac .dmg
npm run build:linux # Linux AppImage
```

Los binarios quedan en `dist/`. Para distribución, subirlos a GitHub Releases
del repo `estetikkapp/appestetik` con el tag `agent-vX.Y.Z`. El auto-updater
del agente chequea ese repo y propone updates automáticamente.

## Arquitectura

```
src/
├── main.js          # Electron main process, tray, polling loop
├── preload.js       # Bridge seguro main ↔ renderer
├── whatsapp.js      # Wrapper sobre whatsapp-web.js + Puppeteer
├── api-client.js    # HTTP a /api/bridge/* de appestetika
├── store.js         # Persistencia config (electron-store)
├── logger.js        # Logger minimal con timestamps
└── renderer/
    ├── index.html   # UI del agente
    ├── renderer.js  # UI logic
    └── styles.css   # estilos
```

## Privacidad

- El token de vinculación se guarda **solo en este equipo** (en %APPDATA% en Windows).
  appestetika.com solo guarda el hash sha256.
- Los mensajes de WhatsApp **no pasan por appestetika.com** — el agente los envía
  directo desde tu WhatsApp Web a los destinatarios. El servidor solo te dice
  "manda este texto a este número".
- El QR **no se guarda en ningún lado** permanentemente. Aparece en pantalla
  mientras lo necesitás y se descarta apenas vincules.

## Licencia

Propietaria · appestetika
