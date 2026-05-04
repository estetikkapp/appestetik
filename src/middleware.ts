import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const AUTH_ROUTES = ['/auth/login', '/auth/signup'];
const PUBLIC_PREFIXES = ['/auth', '/c/', '/api/public'];
const ACTIVE_ORG_COOKIE = 'active_org';

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/') return false; // home va al panel
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/favicon')) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Rutas públicas: pasan sin auth check
  if (isPublicRoute(pathname) && !isAuthRoute(pathname)) {
    return response;
  }

  // Sin user: rutas protegidas → login
  if (!user) {
    if (isAuthRoute(pathname)) return response;
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Con user en rutas de auth: resolver destino según onboarding
  // Pero primero necesitamos saber la org activa del user
  type MembershipRow = {
    organization_id: string;
    role: string;
    organizations:
      | { id: string; onboarded_at: string | null; name: string }
      | { id: string; onboarded_at: string | null; name: string }[]
      | null;
  };
  let memberships: MembershipRow[] | null = null;
  try {
    const queryPromise = supabase
      .from('memberships')
      .select('organization_id, role, organizations(id, onboarded_at, name)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
    const result = await Promise.race([queryPromise, timeoutPromise]);
    if (result === null) {
      console.error('[middleware] memberships query timeout');
      return response;
    }
    memberships = result.data as MembershipRow[] | null;
  } catch (err) {
    console.error('[middleware] memberships query falló:', err);
    return response;
  }

  // Caso: user sin ningún membership → estado inválido, logout
  if (!memberships || memberships.length === 0) {
    await supabase.auth.signOut();
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('error', 'Cuenta sin organizacion asignada');
    return NextResponse.redirect(loginUrl);
  }

  // Resolver active_org: cookie válida o fallback al más reciente
  const cookieOrg = request.cookies.get(ACTIVE_ORG_COOKIE)?.value;
  const validCookieOrg = cookieOrg && memberships.find((m) => m.organization_id === cookieOrg);
  const activeMembership = validCookieOrg
    ? memberships.find((m) => m.organization_id === cookieOrg)!
    : memberships[0]!;

  // Si la cookie no era válida, la actualizamos
  if (!validCookieOrg) {
    response.cookies.set(ACTIVE_ORG_COOKIE, activeMembership.organization_id, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
  }

  // Extraer datos de la org (supabase embebió la fila vía relación)
  const org = Array.isArray(activeMembership.organizations)
    ? activeMembership.organizations[0]
    : activeMembership.organizations;
  const isOnboarded = !!org?.onboarded_at;
  const isOwner = activeMembership.role === 'owner';

  // Rutas de auth con user ya logueado
  if (isAuthRoute(pathname)) {
    const dest = isOnboarded ? '/' : '/onboarding';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Org no onboarded + user no owner → página "esperando owner"
  if (!isOnboarded && !isOwner && !pathname.startsWith('/waiting-setup')) {
    return NextResponse.redirect(new URL('/waiting-setup', request.url));
  }

  // Org no onboarded + user owner → onboarding
  if (!isOnboarded && isOwner && !pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Org ya onboarded + user intenta ir a /onboarding → home
  if (isOnboarded && pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
