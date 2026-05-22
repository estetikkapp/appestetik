'use client';

import * as React from 'react';
import { Loader2, CreditCard } from 'lucide-react';

/**
 * Botón "Activar plan" — dispara el flujo de pago.
 *
 * POST a /api/subscriptions/activate → el server crea el preapproval/checkout
 * de MP y devuelve init_point → redirigimos a MP para que la clienta autorice
 * el débito. Cuando vuelve, el webhook ya marcó (o marcará) la sub como active.
 */
export function ActivatePlanButton({
  label = 'Activar plan',
  variant = 'primary',
}: {
  label?: string;
  variant?: 'primary' | 'inline';
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function activate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions/activate', { method: 'POST' });
      const json = (await res.json()) as { ok?: boolean; init_point?: string; error?: string };
      if (!res.ok || !json.ok || !json.init_point) {
        setError(json.error ?? 'No se pudo iniciar el pago.');
        setLoading(false);
        return;
      }
      // Redirigir a Mercado Pago para autorizar el débito.
      window.location.href = json.init_point;
    } catch {
      setError('Error de conexión. Probá de nuevo.');
      setLoading(false);
    }
  }

  if (variant === 'inline') {
    return (
      <span className="inline-flex flex-col">
        <button
          type="button"
          onClick={activate}
          disabled={loading}
          className="font-medium underline disabled:opacity-60"
        >
          {loading ? 'Redirigiendo...' : label}
        </button>
        {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={activate}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading ? 'Redirigiendo a Mercado Pago...' : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
