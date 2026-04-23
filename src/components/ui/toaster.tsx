'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-stone-900 group-[.toaster]:border group-[.toaster]:border-stone-200 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-stone-500',
          actionButton: 'group-[.toast]:bg-brand-500 group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-stone-100 group-[.toast]:text-stone-500',
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
