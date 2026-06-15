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
 * Supabase manda el link en uno de dos formatos según cómo esté configurado
 * el proyecto:
 *
 *   1) PKCE flow (default desde @supabase/ssr 0.4+):
 *        ?code=xxx
 *      → Usamos exchangeCodeForSession(code).
 *      Problema: PKCE requiere code_verifier guardado en cookie del browser
 *      que pidió el reset. Si el user abre el link en OTRO browser (Gmail
 *      app, Outlook web, otro PC) puede fallar con "code verifier missing".
 *
 *   2) OTP flow (legacy / cross-browser):
 *        ?token_hash=xxx&type=recovery
 *      → Usamos verifyOtp({ token_hash, type: 'recovery' }).
 *      Funciona desde cualquier browser, no requiere cookie previa.
 *
 * Soportamos AMBOS para máxima resistencia a errores de UX. Si vienen los
 * dos params, preferimos token_hash porque es cross-browser.
 *
 * También maneja `?error=...&error_description=...` que Supabase envía si
 * el link es inválido antes de redirigir acá.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: {
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
  };
}) {
  const supabase = createClient();

  // 1) Error explícito de Supabase (link inválido / vencido antes del exchange)
  if (searchParams.error && !searchParams.code && !searchParams.token_hash) {
    const msg = searchParams.error_description ?? searchParams.error;
    redirect(
      `/auth/recuperar-password?error=${encodeURIComponent(
        `El link no es válido o venció (${msg.slice(0, 80)}). Pedí uno nuevo.`
      )}`
    );
  }

  // 2) OTP flow — preferido porque es cross-browser
  if (searchParams.token_hash && searchParams.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: searchParams.token_hash,
      type: searchParams.type as 'recovery' | 'email' | 'signup',
    });
    if (error) {
      console.error('[reset-password] verifyOtp fail:', error.message);
      redirect(
        `/auth/recuperar-password?error=${encodeURIComponent(
          'El link venció o ya fue usado. Pedí uno nuevo y abrilo desde el mismo dispositivo.'
        )}`
      );
    }
  }
  // 3) PKCE flow — solo si no vino token_hash
  else if (searchParams.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(searchParams.code);
    if (error) {
      console.error('[reset-password] exchangeCodeForSession fail:', error.message);
      // Si falla PKCE (típicamente "code verifier missing"), explicar el
      // workaround: pedir un link nuevo y abrirlo en el mismo browser.
      redirect(
        `/auth/recuperar-password?error=${encodeURIComponent(
          'El link no se pudo verificar (puede ser que lo abriste en otro browser). Pedí uno nuevo y abrilo desde el mismo dispositivo donde pediste el reset.'
        )}`
      );
    }
  }

  // 4) Verificar que ahora hay sesión. Si no, el user llegó acá sin nada
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

  // 5) Mostrar form. El error de submit lo capturamos del searchParams.
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
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
