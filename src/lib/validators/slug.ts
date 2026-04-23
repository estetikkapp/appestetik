/**
 * Slugs reservados del sistema. No pueden ser usados como slug público
 * de una organización porque colisionarían con rutas de la app.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'admin', 'api', 'panel', 'auth', 'c', 'public',
  'login', 'signup', 'logout', 'onboarding', 'invitations',
  'app', 'www', 'help', 'about', 'terms', 'privacy',
  'dashboard', 'settings', 'configuracion', 'cuenta',
  'pricing', 'precios', 'blog', 'docs', 'support',
];

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

/**
 * Valida un slug para URL pública:
 * - 3-40 caracteres
 * - Lowercase alfanumérico + guiones
 * - No empieza ni termina con guión
 * - No está en RESERVED_SLUGS
 */
export function isValidSlug(input: string | null | undefined): boolean {
  if (!input) return false;
  if (!SLUG_REGEX.test(input)) return false;
  if (RESERVED_SLUGS.includes(input)) return false;
  return true;
}
