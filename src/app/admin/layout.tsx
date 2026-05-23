import Link from 'next/link';
import { requirePlatformAdmin } from '@/lib/auth/require-platform-admin';

export const metadata = { title: 'Plataforma — appestetika admin' };

// Siempre dinámico: nunca cachear el back office.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard: si no es super-admin, esto lanza notFound() (404).
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-stone-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded bg-brand-500 px-2 py-0.5 text-xs font-bold">ADMIN</span>
            <Link href="/admin" className="text-sm font-semibold">
              Plataforma appestetika
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-300">
            <span>{admin.email}</span>
            <Link href="/" className="text-stone-400 hover:text-white">
              ← Volver al panel
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
