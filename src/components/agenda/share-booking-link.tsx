'use client';

import * as React from 'react';
import { Share2, Copy, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  slug: string;
  orgName: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

/**
 * Botón que abre un popover con el link público de reserva de la org —
 * para que el dueño lo pegue rápido en Instagram, WhatsApp, etc.
 *
 * Es la fricción más alta para activar: si el dueño no encuentra su link,
 * no comparte → no llegan reservas → la app no se usa. Por eso lo ponemos
 * arriba en /agenda al lado de "Nuevo turno".
 */
export function ShareBookingLink({ slug, orgName }: Props) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const publicUrl = `${APP_URL}/c/${slug}`;
  const whatsappText = `Hola! Te dejo mi link para reservar turno en ${orgName}: ${publicUrl}`;
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op (clipboard puede fallar en HTTP / iframes)
    }
  }

  // Cierre del popover al hacer click fuera
  const popRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={popRef}>
      <Button variant="outline" onClick={() => setOpen((o) => !o)}>
        <Share2 className="mr-2 h-4 w-4" />
        Compartir link
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          <p className="mb-1 text-sm font-semibold text-stone-900">Tu link de reserva</p>
          <p className="mb-3 text-xs text-stone-500">
            Pegalo en tu bio de Instagram, en WhatsApp, o donde quieras que las clientas
            reserven solas.
          </p>

          <div className="mb-3 flex gap-2">
            <input
              readOnly
              value={publicUrl}
              className="flex h-9 flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              size="sm"
              variant={copied ? 'default' : 'outline'}
              onClick={copyUrl}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" /> ¡Listo!
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> Copiar
                </>
              )}
            </Button>
          </div>

          <a
            href={whatsappShare}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Compartir por WhatsApp
          </a>

          <p className="mt-3 text-xs text-stone-400">
            Tip: también podés embeber el formulario directamente en tu sitio web desde{' '}
            <a href="/configuracion" className="underline hover:text-brand-600">
              Configuración
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
