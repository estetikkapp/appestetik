'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/**
 * Nav mobile para el header de /ayuda. En pantallas chicas el menú entero
 * (Precios, Iniciar sesión, Probar gratis) se apretaba/desbordaba, así que
 * lo escondemos detrás de un hamburger que abre un Sheet lateral.
 */
export function MobileHelpNav() {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Abrir menú"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetTitle>Menú</SheetTitle>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <SheetClose asChild>
            <Link
              href="/precios"
              className="rounded-lg px-3 py-3 text-stone-700 hover:bg-stone-50 hover:text-stone-900"
            >
              Precios
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-3 text-stone-700 hover:bg-stone-50 hover:text-stone-900"
            >
              Iniciar sesión
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/auth/signup"
              className="mt-2 rounded-lg bg-brand-500 px-3 py-3 text-center font-medium text-white hover:bg-brand-600"
            >
              Probar gratis
            </Link>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
