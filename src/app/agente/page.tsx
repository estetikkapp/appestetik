import Link from 'next/link';
import { Download, Apple, Monitor, Laptop } from 'lucide-react';

export const metadata = {
  title: 'Descargar agente local — appestetika',
  description:
    'Conectá tu WhatsApp con appestetika para enviar recordatorios automáticos a tus clientas.',
};

interface DownloadOption {
  os: 'windows' | 'mac' | 'linux';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  filename: string;
  url: string;
}

// Estos URLs apuntan al "latest" release del agente en GitHub. Cuando se
// publique un release con tag `agent-vX.Y.Z`, GitHub mantiene el "latest"
// link estable y los archivos quedan disponibles sin tener que cambiar el
// hardcoded URL acá.
const RELEASES_BASE = 'https://github.com/estetikkapp/appestetik/releases/latest/download';

const DOWNLOADS: DownloadOption[] = [
  {
    os: 'windows',
    label: 'Windows',
    icon: Monitor,
    description: 'Windows 10 / 11 (64-bit)',
    filename: 'appestetika-bridge-setup.exe',
    url: `${RELEASES_BASE}/appestetika-bridge-setup.exe`,
  },
  {
    os: 'mac',
    label: 'Mac',
    icon: Apple,
    description: 'macOS 11+ (Intel y Apple Silicon)',
    filename: 'appestetika-bridge.dmg',
    url: `${RELEASES_BASE}/appestetika-bridge.dmg`,
  },
  {
    os: 'linux',
    label: 'Linux',
    icon: Laptop,
    description: 'Ubuntu / Debian / Fedora (AppImage)',
    filename: 'appestetika-bridge.AppImage',
    url: `${RELEASES_BASE}/appestetika-bridge.AppImage`,
  },
];

// Verifica si el release de GitHub ya tiene los binarios subidos. Cache de
// 5min para no martillar la API. Si todavía no hay release (o falla la
// llamada), mostramos los botones como deshabilitados con mensaje claro.
async function checkReleaseAvailable(): Promise<{
  ready: boolean;
  windowsOk: boolean;
  macOk: boolean;
  linuxOk: boolean;
}> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/estetikkapp/appestetik/releases/latest',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return { ready: false, windowsOk: false, macOk: false, linuxOk: false };
    const data = (await res.json()) as { assets?: Array<{ name: string }> };
    const assets = data.assets ?? [];
    const has = (suffix: string) =>
      assets.some((a) => a.name.toLowerCase().endsWith(suffix.toLowerCase()));
    return {
      ready: has('.exe') || has('.dmg') || has('.AppImage'),
      windowsOk: has('.exe'),
      macOk: has('.dmg'),
      linuxOk: has('.AppImage'),
    };
  } catch {
    return { ready: false, windowsOk: false, macOk: false, linuxOk: false };
  }
}

export default async function AgentePage() {
  const release = await checkReleaseAvailable();
  return (
    <main className="min-h-screen bg-brand-50/30">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-brand-700">
            appestetika
          </Link>
          <Link href="/auth/login" className="text-sm text-brand-600 hover:underline">
            Iniciar sesión →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-12">
        <section className="text-center">
          <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
            Agente local para WhatsApp
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-stone-600">
            Descargá el mini-programa que conecta tu WhatsApp con appestetika para enviar
            recordatorios automáticos a tus clientas. Gratis, sin Meta Business, sin trucos.
          </p>
        </section>

        <section>
          {!release.ready && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Binarios en construcción</strong> — el primer release del agente
              está compilándose en GitHub Actions ahora mismo (toma ~10-15 min). Recargá
              esta página en un rato y los links van a funcionar. Mientras tanto, podés
              probarlo en modo desarrollo (ver instrucciones abajo).
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {DOWNLOADS.map((d) => {
              const Icon = d.icon;
              const isAvailable =
                d.os === 'windows'
                  ? release.windowsOk
                  : d.os === 'mac'
                    ? release.macOk
                    : release.linuxOk;
              const className = isAvailable
                ? 'flex flex-col items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white p-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30'
                : 'flex flex-col items-center gap-3 rounded-2xl border-2 border-stone-200 bg-stone-50 p-6 text-center opacity-60 cursor-not-allowed';
              return isAvailable ? (
                <a
                  key={d.os}
                  href={d.url}
                  download
                  className={className}
                >
                  <Icon className="h-12 w-12 text-stone-700" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-stone-900">{d.label}</h3>
                  <p className="text-xs text-stone-500">{d.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">
                    <Download className="h-3 w-3" />
                    Descargar
                  </span>
                </a>
              ) : (
                <div key={d.os} className={className} aria-disabled="true">
                  <Icon className="h-12 w-12 text-stone-400" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-stone-500">{d.label}</h3>
                  <p className="text-xs text-stone-400">{d.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 rounded-lg bg-stone-300 px-4 py-2 text-sm font-medium text-stone-600">
                    Próximamente
                  </span>
                </div>
              );
            })}
          </div>

          {!release.ready && (
            <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50/40 p-4 text-sm">
              <p className="mb-2 font-medium text-stone-900">Para usarlo ahora en modo desarrollo:</p>
              <pre className="overflow-x-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
{`git clone https://github.com/estetikkapp/appestetik.git
cd appestetik/agent
npm install
npm run dev`}
              </pre>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-8">
          <h2 className="mb-6 text-xl font-semibold text-stone-900">Setup en 3 pasos</h2>
          <ol className="space-y-6">
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                1
              </span>
              <div>
                <h3 className="font-medium text-stone-900">Descargá e instalá</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Elegí tu sistema operativo de arriba, descargá el archivo y abrilo. Es
                  un instalador normal: siguiente, siguiente, instalar.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                2
              </span>
              <div>
                <h3 className="font-medium text-stone-900">Generá un código de vinculación</h3>
                <p className="mt-1 text-sm text-stone-600">
                  En appestetika andá a{' '}
                  <Link href="/configuracion" className="text-brand-600 underline">
                    Configuración → Agente local
                  </Link>{' '}
                  y click en &quot;+ Generar código&quot;. Copialo y pegalo en el agente cuando
                  te lo pida.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                3
              </span>
              <div>
                <h3 className="font-medium text-stone-900">Escaneá el QR</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Aparece un QR en el agente (también en el panel de Configuración).
                  En tu celular: WhatsApp → Configuración → Dispositivos vinculados →
                  Vincular dispositivo. ¡Listo!
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-stone-50/40 p-6 text-sm text-stone-700">
          <h3 className="mb-3 font-semibold text-stone-900">Preguntas frecuentes</h3>
          <dl className="space-y-4">
            <div>
              <dt className="font-medium">¿La PC tiene que estar siempre encendida?</dt>
              <dd className="mt-1 text-stone-600">
                Solo cuando se mandan los recordatorios (típicamente 1 vez por día a la
                mañana). Si está apagada, los mensajes se encolan y se mandan cuando
                vuelva a prenderse, hasta 24h después.
              </dd>
            </div>
            <div>
              <dt className="font-medium">¿WhatsApp puede banearme la cuenta por esto?</dt>
              <dd className="mt-1 text-stone-600">
                Es WhatsApp Web oficial, lo mismo que abrir web.whatsapp.com en tu Chrome.
                No usamos APIs no oficiales ni protocolos que Meta detecte como abuso. Es
                el mismo nivel de riesgo que tener WhatsApp Web abierto en una compu.
              </dd>
            </div>
            <div>
              <dt className="font-medium">¿appestetika ve los mensajes que mando?</dt>
              <dd className="mt-1 text-stone-600">
                No. El agente recibe del servidor &quot;mandá este texto a este número&quot; y lo
                manda directo desde tu WhatsApp. Los mensajes no pasan por nuestros
                servidores ni se guardan.
              </dd>
            </div>
            <div>
              <dt className="font-medium">¿Y si tengo varias PCs?</dt>
              <dd className="mt-1 text-stone-600">
                Generá un código por PC. Cada una vincula un número distinto, o el mismo
                número (WhatsApp permite hasta 4 dispositivos vinculados por cuenta).
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
