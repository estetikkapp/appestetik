import Link from 'next/link';
import { redirect } from 'next/navigation';
import { updatePassword } from '@/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Nueva contraseña — appestetika' };

/**
 * Página de reset password — el user llega acá desde el link del email.
 *
 * Flujo de Supabase Auth con resetPasswordForEmail():
 *   - El link del email es del tipo:
 *     `${redirectTo}?code=xxx&type=recovery`
 *     (o si pkce, viene con `code` que hay que intercambiar)
 *   - El servidor de Supabase está configurado para redirectTo apuntando
 *     acá. Cuando llega el code, hacemos exchangeCodeForSession() que
 *     establece una sesión TEMPORAL de recovery (válida por 1h o hasta
 *     que el user cambie la password).
 *   - Una vez con sesión válida, mostramos el form. El submit llama
 *     updatePassword() que hace supabase.auth.updateUser({ password }).
 *
 * Si no hay code y no hay sesión, mandamos a recuperar-password para
 * pedir un link nuevo.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; error_description?: string };
}) {
  const supabase = createClient();

  // 1) Si Supabase devolvió error (link vencido / mal formado), redirigir
  //    de vuelta a pedir uno nuevo, sin exponer el detalle técnico.
  if (searchParams.error && !searchParams.code) {
    const msg = searchParams.error_description ?? searchParams.error;
    redirect(
      `/auth/recuperar-password?error=${encodeURIComponent(
        `El link no es válido o venció (${msg.slice(0, 80)}). Pedí uno nuevo.`
      )}`
    );
  }

  // 2) Si viene con code, intercambiarlo por sesión. Si falla, mandar a
  //    recuperar-password.
  if (searchParams.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(searchParams.code);
    if (error) {
      redirect(
        `/auth/recuperar-password?error=${encodeURIComponent(
          'El link venció o ya fue usado. Pedí uno nuevo.'
        )}`
      );
    }
  }

  // 3) Verificar que ahora hay sesión. Si no, el user llegó acá sin link
  //    válido — mandalo a pedir uno.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/recuperar-password?error=${encodeURIComponent(
        'Pedí el link de recuperación desde acá.'
      )}`
    );
  }

  // 4) Mostrar form. El error de submit lo capturamos del searchParams.
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">appestetika</h1>
          <p className="mt-1 text-sm text-stone-500">Definí tu nueva contraseña</p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={updatePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="text-xs text-stone-500">Mínimo 8 caracteres</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Repetí la nueva contraseña</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <SubmitButton className="w-full" pendingText="Guardando...">
            Cambiar contraseña
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
            Cancelar
          </Link>
        </p>
      </div>
    </main>
  );
}
