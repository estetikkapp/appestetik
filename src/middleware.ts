import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Middleware Sprint 1a: solo refresca la sesión de Supabase.
 * La lógica completa de redirects (auth, onboarding, active_org) se agrega en Plan 1b.
 */
export async function middleware(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // Matchea todo excepto assets estáticos y archivos de Next internal
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
