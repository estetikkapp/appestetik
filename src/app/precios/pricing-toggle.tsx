'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Toggle mensual / anual. Cambia ?cycle= en la URL para que el SSR re-renderee
 * las cards con los precios correctos.
 */
export function PricingToggle({ defaultCycle }: { defaultCycle: 'monthly' | 'yearly' }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  function setCycle(cycle: 'monthly' | 'yearly') {
    const params = new URLSearchParams(sp.toString());
    params.set('cycle', cycle);
    startTransition(() => {
      router.replace(`/precios?${params.toString()}#plans`);
    });
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
      <button
        type="button"
        onClick={() => setCycle('monthly')}
        className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
          defaultCycle === 'monthly'
            ? 'bg-brand-500 text-white'
            : 'text-stone-600 hover:text-stone-900'
        }`}
      >
        Mensual
      </button>
      <button
        type="button"
        onClick={() => setCycle('yearly')}
        className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
          defaultCycle === 'yearly'
            ? 'bg-brand-500 text-white'
            : 'text-stone-600 hover:text-stone-900'
        }`}
      >
        Anual
        <span
          className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            defaultCycle === 'yearly'
              ? 'bg-white/20 text-white'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          ahorrás 2 meses
        </span>
      </button>
    </div>
  );
}
