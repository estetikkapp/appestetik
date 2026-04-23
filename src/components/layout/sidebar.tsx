'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Users,
  Scissors,
  Package,
  UserCog,
  Settings,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientas', label: 'Clientas', icon: Users },
  { href: '/servicios', label: 'Servicios', icon: Scissors },
  { href: '/recursos', label: 'Recursos', icon: Package },
  { href: '/empleadas', label: 'Empleadas', icon: UserCog },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <h1 className="text-lg font-bold text-brand-700">appestetika</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-300"
                title="Disponible en próximos sprints"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px]">próximamente</span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-brand-100 text-brand-800 font-medium'
                  : 'text-stone-700 hover:bg-stone-100'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-stone-200 p-3 text-[10px] text-stone-400">
        v0.1.0 · Sprint 1 en desarrollo
      </div>
    </aside>
  );
}
