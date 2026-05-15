'use client';

import { useTransition } from 'react';
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { logout } from '@/actions/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserMenuProps {
  email: string;
  displayName: string | null;
}

export function UserMenu({ email, displayName }: UserMenuProps) {
  const initial = (displayName || email).slice(0, 1).toUpperCase();
  const [pending, startTransition] = useTransition();

  // El patrón anterior <form action={logout}><DropdownMenuItem asChild><button
  // type="submit"> falla porque Radix cierra el menú en el click (unmount del
  // Portal con el form adentro) ANTES de que el submit del form se procese.
  // Resultado: nunca se llamaba a la server action y la sesión seguía abierta.
  //
  // Solución: llamar a `logout` directamente desde `onSelect`. El preventDefault
  // mantiene el menú abierto mientras la transición corre (pendiente). El
  // redirect del server action navega al login al terminar.
  function handleLogout(event: Event) {
    event.preventDefault();
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-stone-900">{displayName || 'Sin nombre'}</span>
            <span className="text-xs font-normal text-stone-500">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="mr-2 h-4 w-4" />
          Mi perfil (próximamente)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleLogout}
          disabled={pending}
          className="cursor-pointer"
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          {pending ? 'Saliendo...' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
