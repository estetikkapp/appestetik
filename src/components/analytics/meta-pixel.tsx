'use client';

import Script from 'next/script';
import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import {
  trackPageView,
  trackLead,
  trackCompleteRegistration,
  trackStartTrial,
} from '@/lib/analytics/meta-pixel';

/**
 * Carga el script de Meta Pixel + dispara los eventos correspondientes.
 *
 * Se monta en el root layout (`src/app/layout.tsx`). Si la env var
 * `NEXT_PUBLIC_META_PIXEL_ID` no está seteada, no inyecta nada (modo
 * desarrollo local sin querer "contaminar" analytics).
 *
 * Disparadores de eventos custom via URL params:
 *   - ?fbq_lead=1                  → trackLead()  (lo seteamos en el onClick
 *                                    del CTA "Probar gratis", pero también
 *                                    accionable desde el server action en
 *                                    redirects si fuera necesario)
 *   - ?fbq_completed_registration=1 → trackCompleteRegistration()
 *   - ?fbq_started_trial=1          → trackStartTrial()
 *
 * Después de disparar, limpia el param de la URL con router.replace para
 * no re-disparar si el user refresca.
 */
export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
      {/* useSearchParams requiere Suspense en App Router para SSG */}
      <Suspense fallback={null}>
        <MetaPixelEventBus />
      </Suspense>
    </>
  );
}

/**
 * Component que escucha cambios de ruta (PageView) y URL params (eventos
 * custom). Cliente puro — no SSR.
 */
function MetaPixelEventBus() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();

  // PageView en cada navegación. El primer PageView ya lo dispara el snippet
  // base de Meta — esto cubre las navegaciones client-side de Next.js que
  // no recargan la página entera.
  useEffect(() => {
    trackPageView();
  }, [pathname]);

  // Eventos custom via URL params. Disparamos + limpiamos el param para no
  // re-disparar al refrescar.
  useEffect(() => {
    if (!sp) return;
    let dirty = false;
    const newParams = new URLSearchParams(sp.toString());

    if (newParams.get('fbq_lead') === '1') {
      trackLead({ content_name: 'cta_probar_gratis' });
      newParams.delete('fbq_lead');
      dirty = true;
    }
    if (newParams.get('fbq_completed_registration') === '1') {
      trackCompleteRegistration({ content_name: 'signup_done' });
      newParams.delete('fbq_completed_registration');
      dirty = true;
    }
    if (newParams.get('fbq_started_trial') === '1') {
      // Valor predicho: precio mensual del plan elegido. Si no lo pasamos,
      // queda en 0 — Meta usa el "value" para optimizar conversiones en ads,
      // pero la atribución funciona aunque sea 0.
      const valueRaw = newParams.get('fbq_value');
      const value = valueRaw ? Number(valueRaw) : undefined;
      const plan = newParams.get('fbq_plan') ?? undefined;
      // event_id para dedup con CAPI server-side (el server action ya
      // disparó el mismo evento con este ID — Meta merge)
      const eventId = newParams.get('fbq_event_id') ?? undefined;
      trackStartTrial(
        {
          value: Number.isFinite(value) ? value : undefined,
          currency: 'ARS',
          content_name: plan ? `trial_${plan}` : 'trial_started',
        },
        eventId
      );
      newParams.delete('fbq_started_trial');
      newParams.delete('fbq_value');
      newParams.delete('fbq_plan');
      newParams.delete('fbq_event_id');
      dirty = true;
    }

    if (dirty) {
      const q = newParams.toString();
      router.replace(`${pathname}${q ? '?' + q : ''}`, { scroll: false });
    }
  }, [sp, pathname, router]);

  return null;
}
