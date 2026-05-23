import Link from 'next/link';
import { Mail, AlertCircle } from 'lucide-react';
import { login, signInWithGoogle } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Iniciar sesión — appestetika' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { signup?: string; error?: string; reset?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">appestetika</h1>
          <p className="mt-1 text-sm text-stone-500">Iniciá sesión en tu cuenta</p>
        </div>

        {searchParams.signup === 'ok' && (
          <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-emerald-900">¡Cuenta creada!</p>
                <p className="mt-1 text-emerald-800">
                  Te mandamos un email para confirmar tu cuenta. Hacé click en el link
                  y volvé acá para iniciar sesión.
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <p>
                    <strong>¿No lo ves?</strong> Revisá la carpeta de{' '}
                    <strong>Spam</strong> o <strong>Promociones</strong> — a veces
                    los mails de confirmación caen ahí. Si lo encontrás, marcalo
                    como &quot;No es spam&quot; para que los próximos lleguen
                    directo al inbox.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {searchParams.reset === 'ok' && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <strong>Contraseña actualizada.</strong> Iniciá sesión con la nueva.
          </div>
        )}
        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={login} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/auth/recuperar-password"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <PasswordInput id="password" name="password" required minLength={8} />
          </div>
          <SubmitButton className="w-full" pendingText="Iniciando sesión...">
            Iniciar sesión
          </SubmitButton>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-stone-400">o</span>
          </div>
        </div>

        <form action={signInWithGoogle}>
          <SubmitButton variant="outline" className="w-full" pendingText="Conectando...">
            Continuar con Google
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          ¿No tenés cuenta?{' '}
          <Link href="/auth/signup" className="font-medium text-brand-600 hover:underline">
            Creá una
          </Link>
        </p>
      </div>
    </main>
  );
}
