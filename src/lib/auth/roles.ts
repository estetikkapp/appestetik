/**
 * Tipos/constantes de roles. Mantenemos esto SIN imports de next/headers
 * ni cookies ni nada server-only, para que pueda ser importado tanto desde
 * server components (require-membership) como desde client components
 * (Sidebar, etc.).
 *
 * Si lo metieramos junto a `requireMembership`, el bundler arrastra
 * `next/headers` al client bundle y revienta el build.
 */

export type Role = 'owner' | 'admin' | 'professional' | 'receptionist';

export const ROLE_RANK: Record<Role, number> = {
  receptionist: 1,
  professional: 2,
  admin: 3,
  owner: 4,
};

export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
