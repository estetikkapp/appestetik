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

export default function AgentePage() {
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
          <div className="grid gap-4 sm:grid-cols-3">
            {DOWNLOADS.map((d) => {
              const Icon = d.icon;
              return (
                <a
                  key={d.os}
                  href={d.url}
                  download
                  className="flex flex-col items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white p-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30"
                >
                  <Icon className="h-12 w-12 text-stone-700" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-stone-900">{d.label}</h3>
                  <p className="text-xs text-stone-500">{d.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">
                    <Download className="h-3 w-3" />
                    Descargar
                  </span>
                </a>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-stone-400">
            Los binarios pueden tardar en aparecer si todavía no se publicó el primer release.
            <br />
            En ese caso, podés clonar el repo y correr <code>npm run dev</code> en{' '}
            <code>agent/</code> para usarlo en modo desarrollo.
          </p>
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
