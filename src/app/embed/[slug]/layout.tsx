import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservá tu turno',
  // Permitir embedding (sin x-frame-options en este path)
  robots: { index: false },
};

/**
 * Layout minimal para el widget embebible. No incluye header del centro
 * ni footer pesado — pensado para iframe en bio link, sitio web, etc.
 *
 * El contenido hereda el RootLayout (font, body) — acá solo agregamos un
 * contenedor compacto.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
