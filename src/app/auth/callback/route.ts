import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback de auth — recibe el link que abre el user desde el email.
 *
 * Supabase moderno manda los links en uno de dos formatos:
 *
 *   1) PKCE flow (default):
 *        /auth/callback?code=xxx&next=/
 *      → Usamos exchangeCodeForSession(code).
 *      Problema: PKCE requiere code_verifier guardado en cookie del browser
 *      original. Si el user abre el link en otro browser, falla.
 *
 *   2) OTP flow (legacy, cross-browser):
 *        /auth/callback?token_hash=xxx&type=signup|recovery|email_change&next=/
 *      → Usamos verifyOtp({ token_hash, type }).
 *
 * Soportamos AMBOS para no romperle el flow a quien recibe un mail y lo
 * abre en un browser distinto (Gmail app embebida, etc.).
 *
 * Si type=recovery viene acá (algunos templates de Supabase apuntan al
 * callback en lugar de a reset-password directo), redirigimos a la página
 * de reset password con la sesión ya establecida.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/';

  const supabase = createClient();

  // OTP flow primero (cross-browser safe)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'recovery' | 'email_change' | 'invite' | 'email',
    });
    if (!error) {
      // Si es recovery, llevarlo a la página de cambiar password en vez de "/"
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[auth/callback] verifyOtp fail:', error.message);
  }

  // PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[auth/callback] exchangeCodeForSession fail:', error.message);
  }

  // Si llegamos acá es que no había params válidos o todos fallaron.
  // Diferenciamos el mensaje según si era recovery o signup.
  const errorMsg =
    type === 'recovery'
      ? 'El link de recuperación venció o ya fue usado. Pedí uno nuevo.'
      : 'No se pudo autenticar. Si recién creaste la cuenta, pedí un nuevo mail de confirmación desde el login.';

  const dest =
    type === 'recovery' ? '/auth/recuperar-password' : '/auth/login';
  return NextResponse.redirect(`${origin}${dest}?error=${encodeURIComponent(errorMsg)}`);
}
