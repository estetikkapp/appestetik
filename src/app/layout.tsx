import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { MetaPixel } from '@/components/analytics/meta-pixel';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com'),
  title: {
    default: 'appestetika',
    template: '%s · appestetika',
  },
  description: 'SaaS de gestión para centros de estética argentinos',
  applicationName: 'appestetika',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'appestetika',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'appestetika',
    title: 'appestetika',
    description: 'Gestión integral para centros de estética',
  },
  twitter: {
    card: 'summary',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#be93a8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
        <MetaPixel />
      </body>
    </html>
  );
}
