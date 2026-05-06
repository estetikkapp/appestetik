import type { MetadataRoute } from 'next';

/**
 * PWA Manifest. Permite "Agregar a pantalla de inicio" en mobile y desktop.
 * Una vez instalada, la app abre standalone (sin barra de URL del browser).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'appestetika · gestión para centros de estética',
    short_name: 'appestetika',
    description:
      'Gestión integral para centros de estética: agenda, clientas, cobros, fichas clínicas y más.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdf7f4',
    theme_color: '#be93a8',
    orientation: 'portrait',
    lang: 'es-AR',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    categories: ['business', 'productivity', 'medical'],
  };
}
