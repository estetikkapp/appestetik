'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  slug: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

export function EmbedSnippet({ slug }: Props) {
  const publicUrl = `${APP_URL}/c/${slug}`;
  const embedUrl = `${APP_URL}/embed/${slug}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="720" frameborder="0" style="border:0; max-width:480px; min-height:520px;" loading="lazy" title="Reservá tu turno"></iframe>`;

  return (
    <div className="space-y-4">
      <CopyField
        label="Link público para Instagram bio / WhatsApp"
        value={publicUrl}
        hint="Pegá este link en tu bio de Instagram, en mensajes de WhatsApp o en tu sitio web."
      />

      <CopyField
        label="Código embed (iframe para sitio propio)"
        value={iframeCode}
        textarea
        hint="Pegá este código en tu sitio web para que la reserva aparezca embebida."
      />
    </div>
  );
}

function CopyField({
  label,
  value,
  textarea,
  hint,
}: {
  label: string;
  value: string;
  textarea?: boolean;
  hint?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-stone-700">{label}</label>
      <div className="flex gap-2">
        {textarea ? (
          <textarea
            readOnly
            value={value}
            rows={3}
            className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-mono"
          />
        ) : (
          <input
            readOnly
            value={value}
            className="flex h-10 flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm"
          />
        )}
        <Button
          type="button"
          onClick={copy}
          variant={copied ? 'default' : 'outline'}
          size="sm"
          className="self-start"
        >
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </>
          )}
        </Button>
      </div>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
