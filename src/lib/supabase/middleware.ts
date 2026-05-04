import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

const AUTH_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Si Supabase está caído/pausado, no bloquear el request — dejar pasar como
  // user=null y que la página decida (probablemente redirect a login → fallará
  // ahí pero al menos no se cuelga el middleware con 504).
  type GetUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
  let user: GetUserResult['data']['user'] = null;
  try {
    const fallback = { data: { user: null }, error: null } as unknown as GetUserResult;
    const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS, fallback);
    user = result.data.user;
  } catch (err) {
    console.error('[middleware] supabase.auth.getUser falló:', err);
    user = null;
  }

  return { response, user, supabase };
}
