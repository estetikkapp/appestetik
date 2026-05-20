import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AyudaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-20 border-b border-stone-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/inicio" className="text-lg font-bold text-brand-700">
            appestetika
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/precios" className="text-stone-600 hover:text-stone-900">
              Precios
            </Link>
            <Link href="/auth/login" className="text-stone-600 hover:text-stone-900">
              Iniciar sesión
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600"
            >
              Probar gratis
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">{children}</main>
    </div>
  );
}
