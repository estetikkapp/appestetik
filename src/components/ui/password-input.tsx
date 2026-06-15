'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

/**
 * Input de password con toggle ojo a la derecha para mostrar/ocultar.
 *
 * Usa los mismos estilos que `Input` (mantener sincronizado si cambia el base).
 * El toggle es puramente cosmético — no toca el valor del input ni cambia el
 * `name`, así que un form que postea esto sigue funcionando igual.
 *
 * Por accesibilidad: el botón tiene `aria-label` dinámico y `tabIndex={-1}`
 * para que el Tab del teclado salte directo al submit (no pase por el ojo).
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(
            // text-base en mobile evita el auto-zoom de iOS al enfocar.
            'flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 pr-10 text-base ring-offset-white placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-stone-400 transition-colors hover:text-stone-600"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
