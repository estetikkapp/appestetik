import Link from 'next/link';
import { Mail, AlertCircle } from 'lucide-react';
import { requestPasswordReset } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Recuperar contraseña — appestetika' };

export default function RecuperarPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  const sent = searchParams.sent === '1';

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">appestetika</h1>
          <p className="mt-1 text-sm text-stone-500">Recuperá tu contraseña</p>
        </div>

        {sent ? (
          <>
            <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-emerald-900">Si el email existe, ya te lo mandamos.</p>
                  <p className="mt-1 text-emerald-800">
                    Te llega un link para definir una nueva contraseña. El link vence en
                    1 hora.
                  </p>
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p>
                      <strong>¿No lo ves?</strong> Revisá la carpeta de{' '}
                      <strong>Spam</strong> o <strong>Promociones</strong>. Si lo
                      encontrás, marcalo como &quot;No es spam&quot;.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-sm">
              <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
                Volver al login
              </Link>
            </p>
          </>
        ) : (
          <>
            {searchParams.error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {searchParams.error}
              </div>
            )}

            <p className="mb-4 text-sm text-stone-600">
              Ingresá tu email y te mandamos un link para definir una nueva contraseña.
            </p>

            <form action={requestPasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>
              <SubmitButton className="w-full" pendingText="Enviando link...">
                Mandame el link
              </SubmitButton>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
                ← Volver al login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
