# Progress Log — appestetika

Bitácora de progreso por sprint. Actualizar al cierre de cada sesión de trabajo.

## Sprint 1 — Foundations

### Plan 1a — Core Infrastructure

**Fecha**: 2026-04-23
**Branch**: `feat/sprint-1a-core-infra`
**Estado**: Completo en código. Pendiente aplicar migraciones contra DB real.

**Hecho**:
- Scaffolding Next 14 + TypeScript strict (con `noUncheckedIndexedAccess`) + Tailwind con paleta brand (rosa-nude) y gold
- Dependencias runtime: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `date-fns`, `date-fns-tz`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `class-variance-authority`
- Deps de testing: `vitest`, `@testing-library/react`, `jsdom`
- Supabase CLI instalado (`supabase@2.95`)
- 6 migraciones SQL escritas:
  1. `initial_schema.sql` — organizations + memberships + trigger updated_at
  2. `core_tables.sql` — services, resources, clients, business_hours, invitations
  3. `indexes.sql` — pg_trgm + compuestos para fuzzy search
  4. `rls_policies.sql` — RLS multi-tenant + helpers `user_org_ids` / `user_is_org_admin`
  5. `trigger_new_user.sql` — `on_auth_user_created` crea org+owner O resuelve invitación
  6. `storage_buckets.sql` — bucket `organization-logos` con policies
- Supabase clients: `server.ts`, `client.ts`, `middleware.ts`, `admin.ts`
- Middleware Next stub (solo refresh de sesión)
- Validators (con TDD): `cuit`, `phone-ar`, `dni`, `slug` + blocklist, `email`
- Utils: `cn`, `formatArs`/`parseArs`, `formatPhoneDisplay`, `formatDateAr`/`formatDateTimeAr` + timezone AR fijo
- Types `database.ts` crafteados manualmente (basados en schema SQL); regenerar con `npm run db:types` cuando haya DB conectada
- **73 unit tests verdes**, `npm run build` verde

**Pendiente para cerrar Sprint 1a** (requiere DB conectada):
1. Configurar DB real: Docker + `npm run db:start` OR cuenta cloud + `supabase link + db push`
2. Aplicar migraciones
3. Regenerar types reales con `npm run db:types` (sobreescribe archivo manual)
4. Test manual: crear user en Supabase Studio → verificar trigger crea org + membership owner
5. Completar `.env.local` con keys reales
6. `npm run build` + `npm test` finales

**Pendiente en Plan 1b**:
- Design system (shadcn fork): Button, Input, Form, Dialog, Sheet, Table, Toaster
- Páginas auth: `/auth/login`, `/auth/signup`, `/auth/callback`
- Middleware completo (auth + onboarding + active_org)
- Wizard de onboarding 4 pasos

**Pendiente en Plan 1c**:
- Layout panel (sidebar + header + OrgSwitcher)
- CRUD servicios / recursos / clientas / empleadas
- Invitación de empleadas con `inviteUserByEmail`
- Integration tests (signup flow + tenant isolation)
- Deploy a Vercel staging
