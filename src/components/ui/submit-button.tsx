'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  /**
   * Texto a mostrar mientras está pendiente. Si no se da, deshabilita el botón
   * pero conserva el children original (útil para botones icon-only).
   */
  pendingText?: string;
  /** Si true, oculta el spinner y solo deshabilita (útil para íconos puros) */
  hideSpinner?: boolean;
}

/**
 * Botón de submit con estado de loading automático via useFormStatus.
 * Debe usarse SIEMPRE dentro de un <form action={serverAction}>.
 *
 * - Mientras la action está en vuelo, el botón se deshabilita
 * - Si tiene texto, lo reemplaza por "{pendingText}" + spinner
 * - Previene doble submit por click rápido o Enter repetido
 */
export function SubmitButton({
  children,
  pendingText,
  hideSpinner,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <Button type="submit" disabled={isDisabled} {...props}>
      {pending && !hideSpinner && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
