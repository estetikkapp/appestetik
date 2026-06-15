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
  Gift,
  Sparkles,
  CreditCard,
  Clock,
  CalendarOff,
  History,
  ListChecks,
  BarChart3,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getRouteAccessState, type Role, type PlanContext } from '@/lib/auth/rbac';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  /** Selector para el welcome tour de Joyride (data-tour="<id>"). */
  tourId?: string;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard, tourId: 'inicio' },
  { href: '/agenda', label: 'Agenda', icon: Calendar, tourId: 'agenda' },
  { href: '/espera', label: 'Lista de espera', icon: ListChecks },
  { href: '/clientas', label: 'Clientas', icon: Users, tourId: 'clientas' },
  { href: '/servicios', label: 'Servicios', icon: Scissors, tourId: 'servicios' },
  { href: '/paquetes', label: 'Paquetes', icon: Gift },
  { href: '/cobros', label: 'Cobros', icon: CreditCard },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/recursos', label: 'Recursos', icon: Package },
  { href: '/empleadas', label: 'Empleadas', icon: UserCog, tourId: 'empleadas' },
  { href: '/horarios', label: 'Horarios', icon: Clock, tourId: 'horarios' },
  { href: '/cierres', label: 'Cierres', icon: CalendarOff },
  { href: '/ia', label: 'IA', icon: Sparkles, tourId: 'ia' },
  { href: '/audit-log', label: 'Audit log', icon: History },
  { href: '/configuracion', label: 'Configuración', icon: Settings, tourId: 'configuracion' },
  { href: '/ayuda', label: 'Ayuda', icon: HelpCircle, tourId: 'ayuda' },
];

interface SidebarNavProps {
  role: Role;
  /**
   * Plan + grandfathered status para filtrar items por feature, no solo por
   * rol. Si no se pasa, solo se filtra por rol (compat con páginas viejas).
   */
  planContext?: PlanContext;
  /**
   * Callback opcional al hacer click en un item. Lo usa el drawer mobile para
   * cerrarse al navegar (en desktop no se pasa).
   */
  onNavigate?: () => void;
}

/**
 * Lista de navegación reutilizable. La renderiza tanto el `Sidebar` de
 * escritorio (aside fijo) como el `MobileNav` (dentro de un Sheet drawer),
 * para que ambos compartan exactamente los mismos items, gating y estilos.
 */
export function SidebarNav({ role, planContext, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  // Computamos el estado de cada item según rol + plan.
  // Items hidden_by_role los filtramos (recepcionista no ve /configuracion).
  // Items locked_by_plan los mostramos GRISES con candado + pill "Equipo" +
  // link directo a /precios?from=<feature> para que la dueña entienda qué
  // se desbloquea y considere upgradear.
  const navWithAccess = NAV.map((item) => ({
    ...item,
    access: getRouteAccessState(role, item.href, planContext),
  })).filter((item) => item.access.state !== 'hidden_by_role');

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {navWithAccess.map((item) => {
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

        // Locked by plan: muestro el item gris + Lock icon + pill "Equipo",
        // y el click va a /precios con el feature como contexto para que
        // el banner de la página de precios explique qué se desbloquea.
        if (item.access.state === 'locked_by_plan') {
          const feature = item.access.lockedFeature;
          return (
            <Link
              key={item.href}
              href={`/precios?from=${encodeURIComponent(feature ?? '')}`}
              data-tour={item.tourId}
              onClick={onNavigate}
              title={`Disponible en el plan Equipo`}
              className="group flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <Lock className="h-3 w-3" />
                <span className="rounded-full bg-brand-100/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                  Equipo
                </span>
              </span>
            </Link>
          );
        }

        // Accesible normal
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.tourId}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-brand-100 text-brand-800 font-medium'
                : 'text-stone-700 hover:bg-stone-100'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

interface Props {
  role: Role;
  planContext?: PlanContext;
}

/**
 * Sidebar de escritorio. Oculto por debajo de `md` (en mobile la navegación
 * vive en el drawer `MobileNav` que se abre desde el hamburger del header).
 */
export function Sidebar({ role, planContext }: Props) {
  return (
    <aside className="hidden w-60 flex-col border-r border-stone-200 bg-white md:flex">
      <div className="border-b border-stone-200 p-4">
        <h1 className="text-lg font-bold text-brand-700">appestetika</h1>
      </div>
      <SidebarNav role={role} planContext={planContext} />
      <div className="border-t border-stone-200 p-3 text-[10px] text-stone-400">
        v0.1.0 · Sprint 1 en desarrollo
      </div>
    </aside>
  );
}
