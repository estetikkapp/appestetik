'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trackLead } from '@/lib/analytics/meta-pixel';

/**
 * CTA "Probar gratis" que dispara evento `Lead` de Meta antes de navegar.
 *
 * Por qué client component: Meta Pixel vive en el browser. El onClick del
 * Link nativo de Next.js no espera al disparo (navegación es síncrona), así
 * que disparamos el evento inmediatamente — fbq encola si todavía no cargó
 * el script.
 *
 * Reemplazá los <Link href="/auth/signup">Probar gratis</Link> del landing
 * por este componente para que cada click trackee.
 */
export function ProbarGratisCTA({
  href = '/auth/signup',
  className,
  contentName,
  children,
}: {
  href?: string;
  className?: string;
  /** Identificador del botón en analytics (ej. "hero_cta", "footer_cta"). */
  contentName?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackLead({ content_name: contentName ?? 'probar_gratis' });
      }}
    >
      {children}
    </Link>
  );
}
