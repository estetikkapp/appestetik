import type { ReactNode } from 'react';
import Link from 'next/link';

export default function InicioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-stone-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/inicio" className="text-lg font-bold text-brand-700">
            appestetika
          </Link>
          {/* Mobile: solo CTA. Los links de navegación (Precios, Ayuda, Login)
              quedan accesibles desde el footer para no apretar el header.
              Desktop: nav completa. */}
          <nav className="flex items-center gap-3 text-sm md:gap-6">
            <Link
              href="/precios"
              className="hidden text-stone-600 hover:text-stone-900 md:inline"
            >
              Precios
            </Link>
            <Link
              href="/ayuda"
              className="hidden text-stone-600 hover:text-stone-900 md:inline"
            >
              Ayuda
            </Link>
            <Link
              href="/auth/login"
              className="hidden text-stone-600 hover:text-stone-900 md:inline"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 sm:px-4"
            >
              Probar gratis
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-stone-100 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-stone-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} appestetika · Hecho en Argentina</p>
            <div className="flex gap-4">
              <Link href="/precios" className="hover:text-stone-900">
                Precios
              </Link>
              <Link href="/ayuda" className="hover:text-stone-900">
                Ayuda
              </Link>
              <Link href="/agente" className="hover:text-stone-900">
                Agente WhatsApp
              </Link>
              <a href="mailto:estetikkapp@gmail.com" className="hover:text-stone-900">
                Contacto
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
