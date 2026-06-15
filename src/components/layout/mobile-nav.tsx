'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarNav } from './sidebar';
import type { Role, PlanContext } from '@/lib/auth/rbac';

/**
 * Navegación mobile. Un botón hamburguesa (visible solo por debajo de `md`)
 * que abre un drawer lateral (Sheet side="left") con la misma lista de
 * navegación que el Sidebar de escritorio. Se cierra solo al tocar un item.
 */
export function MobileNav({ role, planContext }: { role: Role; planContext?: PlanContext }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menú"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[82vw] p-0">
        <div className="flex h-full flex-col">
          <div className="border-b border-stone-200 p-4">
            <h1 className="text-lg font-bold text-brand-700">appestetika</h1>
          </div>
          <SidebarNav
            role={role}
            planContext={planContext}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
