# Sprint 1a — Core Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar appestetika con Next 14 scaffolding + Supabase local corriendo + schema multi-tenant con RLS desplegado + types TS generados + validators/utils centralizados con tests verdes. Sin UI todavía — eso es Plan 1b.

**Architecture:** Single Next.js 14 App Router app. Supabase Postgres multi-tenant con RLS policies basadas en subquery a `memberships`. Trigger `on_auth_user_created` genera organización + membership owner en signup (o resuelve invitación si hay token). TDD para validators.

**Tech Stack:** Next.js 14.2.35, React 18, TypeScript 5, Tailwind 3.4, @supabase/ssr 0.10.2, @supabase/supabase-js 2.103.0, Zod 3.23, Vitest 1.

**Milestone al terminar:** `npm run build` verde, `npm test` verde con ~40 unit tests, `supabase status` muestra stack local corriendo, `src/types/database.ts` generado con todas las tablas, signup via Supabase dashboard crea org + membership owner automáticamente.

---

## File Structure

### Archivos a crear

**Config:**
- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.eslintrc.json`
- `.env.example`, `.env.local` (gitignored)
- `README.md` (Sprint 1a stub)

**Next app placeholders (mínimo para compilar):**
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/middleware.ts` (solo refresh de sesión, auth logic completa en Plan 1b)

**Supabase clients:**
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/admin.ts`

**Validators (con test):**
- `src/lib/validators/cuit.ts` + `tests/unit/validators/cuit.test.ts`
- `src/lib/validators/phone-ar.ts` + `tests/unit/validators/phone-ar.test.ts`
- `src/lib/validators/dni.ts` + `tests/unit/validators/dni.test.ts`
- `src/lib/validators/slug.ts` + `tests/unit/validators/slug.test.ts`
- `src/lib/validators/email.ts` + `tests/unit/validators/email.test.ts`

**Utils (con test):**
- `src/lib/utils/cn.ts`
- `src/lib/utils/format-ars.ts` + `tests/unit/utils/format-ars.test.ts`
- `src/lib/utils/format-phone.ts` + `tests/unit/utils/format-phone.test.ts`
- `src/lib/utils/dates.ts` + `tests/unit/utils/dates.test.ts`

**Types:**
- `src/types/database.ts` (generado por `supabase gen types`)
- `src/types/app.ts` (manual, placeholder)

**Supabase migrations:**
- `supabase/config.toml` (generado)
- `supabase/migrations/20260423000001_initial_schema.sql`
- `supabase/migrations/20260423000002_core_tables.sql`
- `supabase/migrations/20260423000003_indexes.sql`
- `supabase/migrations/20260423000004_rls_policies.sql`
- `supabase/migrations/20260423000005_trigger_new_user.sql`
- `supabase/migrations/20260423000006_storage_buckets.sql`

**Tests:**
- `tests/setup.ts`

### Archivos a modificar

Ninguno (greenfield).

---

## Prerrequisitos del entorno

Antes de empezar el Plan 1a, el dev necesita:
- Node.js 20 LTS instalado
- Docker Desktop corriendo (Supabase CLI levanta Postgres en un container)
- Git configurado con `user.email` y `user.name`
- Directorio de trabajo: `C:\Users\Tomi\Desktop\SAS PARA CLINICAS DE ESTETICA`
- Git ya inicializado con commit inicial (`.gitignore` + design doc)

Si falta algo de esto, resolverlo antes de empezar Task A1.

---

## Phase A — Project Scaffold

### Task A1: Inicializar Next.js 14 en el directorio actual

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Correr create-next-app en el directorio actual**

Run:
```bash
npx create-next-app@14.2.35 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-install
```

Responde `Yes` si pregunta si querés continuar en directorio no vacío (el `.gitignore` y `docs/` ya existen).

Expected: crea `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `src/app/` con placeholders.

- [ ] **Step 2: Verificar estructura creada**

Run: `ls -la` (o `dir` en PowerShell)

Expected: ver `src/`, `public/`, `node_modules/` no (todavía sin install), `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`.

- [ ] **Step 3: Fijar versión exacta de Next en package.json**

Editar `package.json` para asegurar:
```json
"next": "14.2.35",
"react": "^18",
"react-dom": "^18"
```

Si `create-next-app` puso una versión distinta (ej `14.2.40`), bajar/subir a `14.2.35` para alinear con SAS PARA SERVICIOS.

- [ ] **Step 4: Instalar dependencias iniciales**

Run: `npm install`

Expected: instala sin errores, genera `package-lock.json`.

- [ ] **Step 5: Verificar que el build funciona**

Run: `npm run build`

Expected: build exitoso, mensaje "Generating static pages (4/4)" o similar. Sin errores TS.

- [ ] **Step 6: Commit**

Run:
```bash
git add -A
git commit -m "feat(scaffold): inicializar proyecto Next 14 con TypeScript y Tailwind"
```

---

### Task A2: Instalar dependencias de runtime

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar Supabase SDK y forms stack**

Run:
```bash
npm install @supabase/ssr@^0.10.2 @supabase/supabase-js@^2.103.0 zod@^3.23 react-hook-form@^7.52 @hookform/resolvers@^3.6 date-fns@^3.6 date-fns-tz@^3.1 clsx tailwind-merge lucide-react@^1.8.0 sonner class-variance-authority
```

Expected: instala sin conflictos de peer deps.

- [ ] **Step 2: Verificar instalación**

Run: `npm list --depth=0`

Expected: ver todas las deps listadas sin warnings UNMET.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): instalar Supabase SDK, zod, react-hook-form, date-fns, lucide, sonner"
```

---

### Task A3: Instalar dependencias de testing

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar Vitest y testing-library**

Run:
```bash
npm install -D vitest@^1 @vitest/ui @testing-library/react@^15 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^24 @types/node
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): instalar Vitest + testing-library para tests unitarios"
```

---

### Task A4: Configurar Tailwind con paleta brand

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`

- [ ] **Step 1: Reemplazar tailwind.config.ts**

Contenido completo:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf7f4',
          100: '#f9ecec',
          200: '#f1d6d3',
          300: '#e5b4ad',
          400: '#d18f87',
          500: '#b96f66',
          600: '#9a544d',
          700: '#7d4039',
          800: '#5e2f2b',
          900: '#42201e',
        },
        gold: {
          400: '#d4a574',
          500: '#c19360',
          600: '#a57a4b',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Reemplazar src/app/globals.css**

Contenido completo:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 42, 32, 30;
  --background-rgb: 253, 247, 244;
}

body {
  color: rgb(var(--foreground-rgb));
  background-color: rgb(var(--background-rgb));
}
```

- [ ] **Step 3: Modificar src/app/page.tsx para verificar paleta**

Reemplazar contenido con:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-brand-700">appestetika</h1>
      <p className="mt-4 text-brand-500">Sprint 1a — scaffolding</p>
      <button className="mt-8 rounded-lg bg-brand-500 px-6 py-3 text-white hover:bg-brand-600 transition">
        Botón de prueba (brand-500)
      </button>
      <button className="mt-4 rounded-lg bg-gold-500 px-6 py-3 text-white hover:bg-gold-600 transition">
        Botón premium (gold-500)
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Verificar dev server y paleta**

Run: `npm run dev`

Abrir http://localhost:3000 en browser. Expected: el título en rosa oscuro, texto más claro debajo, dos botones (rosa-nude y dorado). Detener el server con Ctrl+C después de verificar.

- [ ] **Step 5: Verificar build**

Run: `npm run build`

Expected: build exitoso.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/page.tsx
git commit -m "feat(ui): configurar paleta brand (rosa-nude) + gold en Tailwind"
```

---

### Task A5: Ajustar TypeScript config

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Verificar tsconfig.json tiene strict + paths**

Leer `tsconfig.json`. Asegurar que `compilerOptions` incluye:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Si `noUncheckedIndexedAccess` no está, agregarlo. Si `strict` ya es `true` (default de create-next-app), no tocar.

- [ ] **Step 2: Verificar que build sigue pasando**

Run: `npm run build`

Expected: pasa sin errores. Si aparecen errores por `noUncheckedIndexedAccess`, son bugs reales en el código placeholder — arreglarlos.

- [ ] **Step 3: Commit (solo si hubo cambios)**

```bash
git diff --stat tsconfig.json
# Si hay cambios:
git add tsconfig.json
git commit -m "chore(ts): activar noUncheckedIndexedAccess para mayor seguridad de tipos"
```

---

### Task A6: Crear .env.example y .env.local

**Files:**
- Create: `.env.example`, `.env.local`

- [ ] **Step 1: Crear .env.example**

Contenido completo:
```bash
# ============================================
# Variables de entorno — appestetika
# Copiar a .env.local y completar valores
# ============================================

# Supabase (obligatorio Sprint 1)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# Postergados a sprints siguientes
# ============================================

# AFIP — TusFacturas (Sprint 4)
# TUSFACTURAS_API_KEY=
# TUSFACTURAS_API_TOKEN=
# TUSFACTURAS_USER_TOKEN=

# Mercado Pago (Sprint 3)
# MP_ACCESS_TOKEN=
# MP_PUBLIC_KEY=
# MP_WEBHOOK_SECRET=

# WhatsApp Business (Sprint 3 — proveedor por decidir)
# WABA_PROVIDER=
# WABA_TOKEN=
# WABA_PHONE_NUMBER_ID=

# Claude (Sprint 5)
# ANTHROPIC_API_KEY=
```

- [ ] **Step 2: Crear .env.local (se completa en Phase B)**

Contenido inicial (placeholders; se llenan cuando arranque Supabase local):
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: Verificar que .env.local está gitignored**

Run: `git check-ignore -v .env.local`

Expected: muestra que está ignorado por línea del `.gitignore`.

- [ ] **Step 4: Commit .env.example (NO .env.local)**

```bash
git add .env.example
git commit -m "feat(config): agregar .env.example con vars obligatorias y postergadas"
```

---

## Phase B — Supabase Setup

### Task B1: Inicializar Supabase CLI + stack local

**Files:**
- Create: `supabase/config.toml` (generado), `supabase/seed.sql`

- [ ] **Step 1: Instalar Supabase CLI como dev dep**

Run: `npm install -D supabase@latest`

Expected: se agrega `supabase` en devDependencies.

- [ ] **Step 2: Inicializar proyecto Supabase**

Run: `npx supabase init`

Expected: crea `supabase/config.toml`, `supabase/seed.sql` (vacío), `.gitignore` updates.

Si pregunta sobre VSCode deno settings, responder No.

- [ ] **Step 3: Verificar Docker está corriendo**

Run: `docker ps`

Expected: no error. Si falla con "Cannot connect to the Docker daemon", abrir Docker Desktop y volver a intentar.

- [ ] **Step 4: Levantar stack Supabase local**

Run: `npx supabase start`

Expected: descarga imágenes Docker (primera vez tarda ~5 min), luego muestra:
```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
JWT secret: ...
anon key: eyJ...
service_role key: eyJ...
```

Copiar `anon key` y `service_role key`.

- [ ] **Step 5: Completar .env.local**

Pegar en `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<pegar anon key>
SUPABASE_SERVICE_ROLE_KEY=<pegar service_role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Verificar Studio UI**

Abrir http://127.0.0.1:54323 en browser.

Expected: Supabase Studio se abre, podés ver DB vacía.

- [ ] **Step 7: Commit config.toml**

```bash
git add supabase/config.toml supabase/seed.sql package.json package-lock.json
git commit -m "feat(supabase): inicializar proyecto y levantar stack local"
```

---

### Task B2: Scripts npm para Supabase + types

**Files:**
- Modify: `package.json`
- Create: `src/types/database.ts` (placeholder)

- [ ] **Step 1: Agregar scripts a package.json**

Editar la sección `"scripts"`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:status": "supabase status",
  "db:types": "supabase gen types typescript --local > src/types/database.ts"
}
```

- [ ] **Step 2: Crear placeholder src/types/database.ts**

Contenido:
```typescript
// Placeholder — se genera con `npm run db:types` después de aplicar migraciones.
// No editar manualmente.

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
```

- [ ] **Step 3: Crear src/types/app.ts (placeholder manual)**

Contenido:
```typescript
// Tipos manuales de app (no derivados del schema de DB).
// Agregar aquí unions, helpers de DTO, etc.

export type Role = 'owner' | 'admin' | 'professional' | 'receptionist';
export type TaxCondition = 'monotributo' | 'responsable_inscripto' | 'exento';
export type AfipProvider = 'tusfacturas' | 'direct' | 'manual';
```

- [ ] **Step 4: Commit**

```bash
git add package.json src/types/
git commit -m "feat(db): agregar scripts npm de Supabase y placeholder de types"
```

---

### Task B3: Clientes Supabase (server, client, middleware, admin)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`, `src/lib/supabase/admin.ts`

- [ ] **Step 1: Crear src/lib/supabase/server.ts**

Contenido completo:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components no pueden setear cookies. Ignorar silenciosamente;
            // el refresh lo maneja el middleware.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // idem
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Crear src/lib/supabase/client.ts**

Contenido completo:
```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Crear src/lib/supabase/middleware.ts**

Contenido completo:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

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

  const { data: { user } } = await supabase.auth.getUser();

  return { response, user, supabase };
}
```

- [ ] **Step 4: Crear src/lib/supabase/admin.ts**

Contenido completo:
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase con service_role key.
 * NUNCA importar desde Client Components — expone permisos admin.
 * Usar solo en Server Actions / API routes / Server Components donde se necesita
 * bypasear RLS (ej: operaciones admin, invitaciones, seeders).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
```

- [ ] **Step 5: Verificar compilación**

Run: `npm run build`

Expected: pasa sin errores TS. Si falla, revisar paths e imports.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat(supabase): agregar clients server/client/middleware/admin con tipado Database"
```

---

### Task B4: Middleware stub (solo refresh de sesión)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Crear src/middleware.ts**

Contenido completo:
```typescript
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
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`

Expected: pasa, muestra middleware compilado en output.

- [ ] **Step 3: Verificar dev server arranca**

Run: `npm run dev`

Abrir http://localhost:3000. Expected: la home de la Task A4 sigue funcionando. Detener con Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): stub de refresh de sesión (auth logic en Plan 1b)"
```

---

## Phase C — Database Schema

### Task C1: Migración inicial — organizations + memberships

**Files:**
- Create: `supabase/migrations/20260423000001_initial_schema.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:
```sql
-- Migration: initial schema
-- Sprint 1: core tenancy tables (organizations + memberships)

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cuit varchar(11),
  tax_condition text check (tax_condition in ('monotributo', 'responsable_inscripto', 'exento')),
  logo_url text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  slug text unique,
  subscription_tier text not null default 'pro',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  onboarded_at timestamptz,
  afip_provider text check (afip_provider in ('tusfacturas', 'direct', 'manual')) default 'manual',
  afip_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'professional', 'receptionist')),
  display_name text,
  commission_rate numeric(5,2) default 0,
  active boolean not null default true,
  invited_by uuid references auth.users(id),
  invitation_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- updated_at triggers
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_organizations
  before update on public.organizations
  for each row execute function public.tg_set_updated_at();
```

- [ ] **Step 2: Aplicar migración**

Run: `npm run db:reset`

Expected: Supabase reset + apply migrations, muestra "Finished supabase db reset".

- [ ] **Step 3: Verificar tablas existen**

Abrir Supabase Studio http://127.0.0.1:54323, ir a Table Editor. Expected: ver `organizations` y `memberships` en schema public.

Alternativa CLI:
```bash
npx supabase db dump --data-only=false --schema public
```

Expected: output incluye CREATE TABLE organizations / memberships.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423000001_initial_schema.sql
git commit -m "feat(db): migración inicial con organizations y memberships"
```

---

### Task C2: Migración — services, resources, clients, business_hours, invitations

**Files:**
- Create: `supabase/migrations/20260423000002_core_tables.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:
```sql
-- Migration: core tables
-- Sprint 1: services, resources, clients, business_hours, invitations

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  buffer_minutes int default 0 check (buffer_minutes >= 0),
  price_ars numeric(12,2) not null check (price_ars >= 0),
  requires_consent boolean default false,
  requires_resource_type text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone_e164 text,
  email text,
  birthdate date,
  dni text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_visit_at timestamptz
);

create trigger set_updated_at_clients
  before update on public.clients
  for each row execute function public.tg_set_updated_at();

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  active boolean not null default true,
  unique (organization_id, day_of_week),
  check ((active = false) or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'professional', 'receptionist')),
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Aplicar y verificar**

Run: `npm run db:reset`

Expected: completa sin errores.

Abrir Studio, verificar las 5 tablas nuevas existen.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260423000002_core_tables.sql
git commit -m "feat(db): agregar tablas services, resources, clients, business_hours, invitations"
```

---

### Task C3: Migración — indexes (pg_trgm + compuestos)

**Files:**
- Create: `supabase/migrations/20260423000003_indexes.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:
```sql
-- Migration: indexes
-- Sprint 1: fuzzy search en clients + compuestos para listados

create extension if not exists pg_trgm;

-- Clients: fuzzy search por nombre + búsqueda exacta por teléfono/DNI
create index clients_full_name_trgm_idx on public.clients using gin (full_name gin_trgm_ops);
create index clients_phone_e164_idx on public.clients (phone_e164);
create index clients_dni_idx on public.clients (dni);
create index clients_org_created_idx on public.clients (organization_id, created_at desc);

-- Services / resources
create index services_org_active_idx on public.services (organization_id, active);
create index resources_org_active_idx on public.resources (organization_id, active);

-- Memberships
create index memberships_user_active_idx on public.memberships (user_id, active);
create index memberships_org_active_idx on public.memberships (organization_id, active);

-- Invitations
create index invitations_email_org_idx on public.invitations (email, organization_id);
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`

Expected: pasa. `pg_trgm` se instala como extensión.

- [ ] **Step 3: Verificar en Studio**

En Studio → Database → Extensions. Expected: ver `pg_trgm` habilitado.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423000003_indexes.sql
git commit -m "feat(db): agregar indices + pg_trgm para fuzzy search de clientas"
```

---

### Task C4: Migración — RLS policies

**Files:**
- Create: `supabase/migrations/20260423000004_rls_policies.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:
```sql
-- Migration: RLS policies
-- Sprint 1: tenant isolation + role-based access

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.services enable row level security;
alter table public.resources enable row level security;
alter table public.clients enable row level security;
alter table public.business_hours enable row level security;
alter table public.invitations enable row level security;

-- Helper function: devuelve org_ids activos del user autenticado
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select organization_id from public.memberships
  where user_id = auth.uid() and active = true;
$$;

-- Helper: true si el user es owner/admin de la org
create or replace function public.user_is_org_admin(org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and organization_id = org_id
      and active = true
      and role in ('owner', 'admin')
  );
$$;

-- ==========================================
-- organizations
-- ==========================================
create policy "members select own orgs" on public.organizations
  for select using (id in (select public.user_org_ids()));

create policy "owner admin update org" on public.organizations
  for update using (public.user_is_org_admin(id));

-- INSERT de organizations lo hace el trigger (security definer) — no policy para users directos

-- ==========================================
-- memberships
-- ==========================================
create policy "users see own memberships" on public.memberships
  for select using (user_id = auth.uid());

create policy "owner admin see org memberships" on public.memberships
  for select using (public.user_is_org_admin(organization_id));

create policy "owner admin insert memberships" on public.memberships
  for insert with check (public.user_is_org_admin(organization_id));

create policy "owner admin update memberships" on public.memberships
  for update using (public.user_is_org_admin(organization_id));

create policy "owner admin delete memberships" on public.memberships
  for delete using (public.user_is_org_admin(organization_id));

-- ==========================================
-- services
-- ==========================================
create policy "members see services" on public.services
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage services" on public.services
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- resources
-- ==========================================
create policy "members see resources" on public.resources
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage resources" on public.resources
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- clients (receptionist también puede gestionar)
-- ==========================================
create policy "members see clients" on public.clients
  for select using (organization_id in (select public.user_org_ids()));

create policy "staff insert clients" on public.clients
  for insert with check (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

create policy "staff update clients" on public.clients
  for update using (
    organization_id in (
      select organization_id from public.memberships
      where user_id = auth.uid() and active = true
        and role in ('owner', 'admin', 'receptionist')
    )
  );

create policy "owner admin delete clients" on public.clients
  for delete using (public.user_is_org_admin(organization_id));

-- ==========================================
-- business_hours
-- ==========================================
create policy "members see business hours" on public.business_hours
  for select using (organization_id in (select public.user_org_ids()));

create policy "owner admin manage business hours" on public.business_hours
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));

-- ==========================================
-- invitations (solo owner/admin)
-- ==========================================
create policy "owner admin manage invitations" on public.invitations
  for all using (public.user_is_org_admin(organization_id))
  with check (public.user_is_org_admin(organization_id));
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`

Expected: pasa sin errores. Todas las policies creadas.

- [ ] **Step 3: Verificar en Studio**

En Studio → Authentication → Policies. Expected: ver policies en cada tabla.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423000004_rls_policies.sql
git commit -m "feat(db): agregar RLS policies multi-tenant con helpers user_org_ids/is_admin"
```

---

### Task C5: Migración — trigger handle_new_user

**Files:**
- Create: `supabase/migrations/20260423000005_trigger_new_user.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:
```sql
-- Migration: trigger on_auth_user_created
-- Sprint 1: crea org + membership owner automáticamente en signup,
-- o respeta invitación si hay token válido

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_invitation_id uuid;
  invitation_org_id uuid;
  invitation_role text;
  invitation_inviter uuid;
  new_org_id uuid;
begin
  -- Si el signup viene de una invitación, intentar resolverla
  if new.raw_user_meta_data->>'invitation_token' is not null then
    select i.id, i.organization_id, i.role, i.invited_by
    into pending_invitation_id, invitation_org_id, invitation_role, invitation_inviter
    from public.invitations i
    where i.token = new.raw_user_meta_data->>'invitation_token'
      and i.accepted_at is null
      and i.expires_at > now()
      and lower(i.email) = lower(new.email);

    if pending_invitation_id is not null then
      insert into public.memberships (user_id, organization_id, role, invitation_accepted_at, invited_by)
      values (new.id, invitation_org_id, invitation_role, now(), invitation_inviter);

      update public.invitations set accepted_at = now() where id = pending_invitation_id;
      return new;
    end if;
  end if;

  -- Signup normal: crear organización nueva + membership owner
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'organization_name', 'Mi centro'))
  returning id into new_org_id;

  insert into public.memberships (user_id, organization_id, role, invitation_accepted_at)
  values (new.id, new_org_id, 'owner', now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`

Expected: pasa.

- [ ] **Step 3: Test manual del trigger**

Abrir Supabase Studio → Authentication → Users → Add user → Email: `test@test.com`, Password: `password123`, click Create.

Luego Studio → Table Editor → `organizations`. Expected: ver una fila con `name = 'Mi centro'` creada.

Studio → `memberships`. Expected: ver una fila con `user_id` del user creado, `role = 'owner'`, `active = true`.

- [ ] **Step 4: Limpiar user de prueba**

Studio → Authentication → eliminar el user de prueba. La cascade elimina membership + org asociados (por on delete cascade).

Verificar en tablas que `organizations` y `memberships` están vacías.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260423000005_trigger_new_user.sql
git commit -m "feat(db): trigger handle_new_user que crea org+owner o respeta invitacion"
```

---

### Task C6: Migración — storage bucket organization-logos

**Files:**
- Create: `supabase/migrations/20260423000006_storage_buckets.sql`

- [ ] **Step 1: Crear migración**

Contenido completo:
```sql
-- Migration: storage buckets
-- Sprint 1: bucket para logos de organizaciones (privado, signed URLs)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  false,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Policies: owner/admin pueden read/write los archivos de su org
-- Path convention: {organization_id}/logo.{ext}

create policy "owner admin read logos" on storage.objects
  for select using (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "owner admin insert logos" on storage.objects
  for insert with check (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "owner admin update logos" on storage.objects
  for update using (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "owner admin delete logos" on storage.objects
  for delete using (
    bucket_id = 'organization-logos'
    and public.user_is_org_admin(((storage.foldername(name))[1])::uuid)
  );
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`

Expected: pasa. Bucket creado.

- [ ] **Step 3: Verificar**

Studio → Storage. Expected: ver bucket `organization-logos` (privado).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423000006_storage_buckets.sql
git commit -m "feat(db): bucket organization-logos privado con policies de owner/admin"
```

---

### Task C7: Generar types TS del schema

**Files:**
- Modify: `src/types/database.ts` (regenerado)

- [ ] **Step 1: Regenerar types**

Run: `npm run db:types`

Expected: sobreescribe `src/types/database.ts` con tipos completos de las tablas (organizations, memberships, services, resources, clients, business_hours, invitations).

- [ ] **Step 2: Verificar contenido**

Leer `src/types/database.ts`. Expected: tipos `Database`, `Tables`, `Row`, `Insert`, `Update` para cada tabla del schema. Sin errores de sintaxis.

- [ ] **Step 3: Verificar build**

Run: `npm run build`

Expected: pasa. Los Supabase clients ahora usan los tipos reales.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): generar types TypeScript del schema Supabase"
```

---

## Phase D — Validators + Utils (TDD)

### Task D1: Setup Vitest + smoke test

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/unit/sample.test.ts`

- [ ] **Step 1: Crear vitest.config.ts**

Contenido completo:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 2: Crear tests/setup.ts**

Contenido completo:
```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Crear smoke test**

Crear `tests/unit/sample.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Vitest setup', () => {
  it('suma básica', () => {
    expect(1 + 1).toBe(2);
  });

  it('matchers de jest-dom disponibles', () => {
    const el = document.createElement('div');
    el.textContent = 'hola';
    expect(el).toHaveTextContent('hola');
  });
});
```

- [ ] **Step 4: Correr tests**

Run: `npm test`

Expected: 2 tests pasan. Output con "Test Files 1 passed" y "Tests 2 passed".

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/
git commit -m "feat(test): configurar Vitest con jsdom y testing-library"
```

---

### Task D2: Validator CUIT (TDD)

**Files:**
- Create: `tests/unit/validators/cuit.test.ts`, `src/lib/validators/cuit.ts`

- [ ] **Step 1: Escribir test primero**

Crear `tests/unit/validators/cuit.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidCuit, normalizeCuit } from '@/lib/validators/cuit';

describe('normalizeCuit', () => {
  it('remueve guiones', () => {
    expect(normalizeCuit('20-12345678-6')).toBe('20123456786');
  });

  it('remueve espacios', () => {
    expect(normalizeCuit('20 12345678 6')).toBe('20123456786');
  });

  it('deja intacto un CUIT ya normalizado', () => {
    expect(normalizeCuit('20123456786')).toBe('20123456786');
  });
});

describe('isValidCuit', () => {
  it('acepta CUIT persona masculina válido (20)', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true);
  });

  it('acepta CUIT persona femenina válido (27)', () => {
    expect(isValidCuit('27-12345678-0')).toBe(true);
  });

  it('acepta CUIT empresa válido (30)', () => {
    expect(isValidCuit('30-12345678-1')).toBe(true);
  });

  it('acepta CUIT sin guiones', () => {
    expect(isValidCuit('20123456786')).toBe(true);
  });

  it('rechaza dígito verificador incorrecto', () => {
    expect(isValidCuit('20-12345678-0')).toBe(false);
  });

  it('rechaza menos de 11 dígitos', () => {
    expect(isValidCuit('20-1234567-6')).toBe(false);
  });

  it('rechaza más de 11 dígitos', () => {
    expect(isValidCuit('20-123456789-6')).toBe(false);
  });

  it('rechaza con letras', () => {
    expect(isValidCuit('AB-12345678-6')).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(isValidCuit('')).toBe(false);
  });

  it('rechaza null-like', () => {
    expect(isValidCuit(null as unknown as string)).toBe(false);
    expect(isValidCuit(undefined as unknown as string)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

Run: `npm test -- cuit`

Expected: FAIL con "Cannot find module '@/lib/validators/cuit'".

- [ ] **Step 3: Implementar validator**

Crear `src/lib/validators/cuit.ts`:
```typescript
const MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function normalizeCuit(cuit: string): string {
  return cuit.replace(/[\s-]/g, '');
}

/**
 * Valida un CUIT argentino verificando el dígito verificador.
 * Acepta con o sin guiones/espacios.
 */
export function isValidCuit(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const normalized = normalizeCuit(cuit);
  if (!/^\d{11}$/.test(normalized)) return false;

  const digits = normalized.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i]! * MULTIPLIERS[i]!;
  }
  const mod = sum % 11;

  let checkDigit: number;
  if (mod === 0) {
    checkDigit = 0;
  } else if (mod === 1) {
    // Caso borde del algoritmo CUIT: se considera inválido
    return false;
  } else {
    checkDigit = 11 - mod;
  }

  return checkDigit === digits[10];
}
```

- [ ] **Step 4: Correr test — debe pasar**

Run: `npm test -- cuit`

Expected: PASS, todos los tests verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/cuit.ts tests/unit/validators/cuit.test.ts
git commit -m "feat(validators): agregar isValidCuit con algoritmo de digito verificador"
```

---

### Task D3: Validator teléfono argentino (TDD)

**Files:**
- Create: `tests/unit/validators/phone-ar.test.ts`, `src/lib/validators/phone-ar.ts`

- [ ] **Step 1: Escribir test primero**

Crear `tests/unit/validators/phone-ar.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { normalizePhoneAr, isValidPhoneAr } from '@/lib/validators/phone-ar';

describe('normalizePhoneAr', () => {
  it('preserva celular ya normalizado (+549...)', () => {
    expect(normalizePhoneAr('+5491112345678')).toBe('+5491112345678');
  });

  it('remueve espacios y guiones', () => {
    expect(normalizePhoneAr('+54 9 11 1234-5678')).toBe('+5491112345678');
  });

  it('agrega +54 a input de 11 dígitos que empieza con 9', () => {
    expect(normalizePhoneAr('91112345678')).toBe('+5491112345678');
  });

  it('acepta landline +54 + 10 dígitos', () => {
    expect(normalizePhoneAr('+541145678900')).toBe('+541145678900');
  });

  it('devuelve string vacío para input vacío', () => {
    expect(normalizePhoneAr('')).toBe('');
  });
});

describe('isValidPhoneAr', () => {
  it('acepta celular +549 + 10 dígitos', () => {
    expect(isValidPhoneAr('+5491112345678')).toBe(true);
  });

  it('acepta landline +54 + 10 dígitos (sin 9)', () => {
    expect(isValidPhoneAr('+541145678900')).toBe(true);
  });

  it('acepta celular sin formato pero normalizable', () => {
    expect(isValidPhoneAr('+54 9 11 1234 5678')).toBe(true);
  });

  it('rechaza string vacío', () => {
    expect(isValidPhoneAr('')).toBe(false);
  });

  it('rechaza país no argentino', () => {
    expect(isValidPhoneAr('+15551234567')).toBe(false);
  });

  it('rechaza demasiado corto', () => {
    expect(isValidPhoneAr('+549123')).toBe(false);
  });

  it('rechaza demasiado largo', () => {
    expect(isValidPhoneAr('+54911123456789012')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr test — falla**

Run: `npm test -- phone-ar`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar**

Crear `src/lib/validators/phone-ar.ts`:
```typescript
/**
 * Normaliza un teléfono argentino a formato E.164.
 * Celular esperado: +549 + area + número (13 dígitos post +)
 * Landline esperado: +54 + area + número (12 dígitos post +)
 */
export function normalizePhoneAr(input: string): string {
  if (!input) return '';
  const trimmed = input.replace(/[\s\-()]/g, '');

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  // Si empieza con 549 o 54, agregar solo el '+'
  if (trimmed.startsWith('549') || trimmed.startsWith('54')) {
    return '+' + trimmed;
  }

  // Si empieza con 9 + 10 dígitos, asumimos celular sin código país
  if (/^9\d{10}$/.test(trimmed)) {
    return '+54' + trimmed;
  }

  // Fallback: prepend +54 (isValidPhoneAr lo rechazará si no es válido)
  return '+54' + trimmed;
}

/**
 * Valida formato E.164 de teléfono argentino (celular o landline).
 */
export function isValidPhoneAr(input: string | null | undefined): boolean {
  if (!input) return false;
  const normalized = input.startsWith('+') ? input.replace(/[\s\-()]/g, '') : normalizePhoneAr(input);
  // Celular: +549 + 10 dígitos
  if (/^\+549\d{10}$/.test(normalized)) return true;
  // Landline: +54 + 10 dígitos (y NO empieza con +549)
  if (/^\+54\d{10}$/.test(normalized) && !normalized.startsWith('+549')) return true;
  return false;
}
```

- [ ] **Step 4: Correr test — debe pasar**

Run: `npm test -- phone-ar`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/phone-ar.ts tests/unit/validators/phone-ar.test.ts
git commit -m "feat(validators): agregar isValidPhoneAr y normalizacion E.164"
```

---

### Task D4: Validator DNI (TDD)

**Files:**
- Create: `tests/unit/validators/dni.test.ts`, `src/lib/validators/dni.ts`

- [ ] **Step 1: Escribir test**

Crear `tests/unit/validators/dni.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidDni, normalizeDni } from '@/lib/validators/dni';

describe('normalizeDni', () => {
  it('remueve puntos', () => {
    expect(normalizeDni('12.345.678')).toBe('12345678');
  });

  it('remueve espacios', () => {
    expect(normalizeDni('12 345 678')).toBe('12345678');
  });
});

describe('isValidDni', () => {
  it('acepta DNI de 8 dígitos', () => {
    expect(isValidDni('12345678')).toBe(true);
  });

  it('acepta DNI de 7 dígitos', () => {
    expect(isValidDni('1234567')).toBe(true);
  });

  it('acepta DNI con puntos', () => {
    expect(isValidDni('12.345.678')).toBe(true);
  });

  it('rechaza con letras', () => {
    expect(isValidDni('ABC12345')).toBe(false);
  });

  it('rechaza menos de 7 dígitos', () => {
    expect(isValidDni('123456')).toBe(false);
  });

  it('rechaza más de 8 dígitos', () => {
    expect(isValidDni('123456789')).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(isValidDni('')).toBe(false);
  });

  it('rechaza null/undefined', () => {
    expect(isValidDni(null as unknown as string)).toBe(false);
    expect(isValidDni(undefined as unknown as string)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr test — falla**

Run: `npm test -- dni`

Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear `src/lib/validators/dni.ts`:
```typescript
/**
 * Normaliza un DNI argentino removiendo puntos y espacios.
 */
export function normalizeDni(input: string): string {
  return input.replace(/[\s.]/g, '');
}

/**
 * Valida un DNI argentino: 7 u 8 dígitos numéricos puros.
 */
export function isValidDni(input: string | null | undefined): boolean {
  if (!input) return false;
  const normalized = normalizeDni(input);
  return /^\d{7,8}$/.test(normalized);
}
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm test -- dni`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/dni.ts tests/unit/validators/dni.test.ts
git commit -m "feat(validators): agregar isValidDni (7-8 digitos)"
```

---

### Task D5: Validator slug (TDD con blocklist)

**Files:**
- Create: `tests/unit/validators/slug.test.ts`, `src/lib/validators/slug.ts`

- [ ] **Step 1: Escribir test**

Crear `tests/unit/validators/slug.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidSlug, RESERVED_SLUGS } from '@/lib/validators/slug';

describe('isValidSlug', () => {
  it('acepta slug válido simple', () => {
    expect(isValidSlug('centro-belleza')).toBe(true);
  });

  it('acepta slug con números', () => {
    expect(isValidSlug('estetica123')).toBe(true);
  });

  it('acepta slug de 3 caracteres (mínimo)', () => {
    expect(isValidSlug('abc')).toBe(true);
  });

  it('rechaza slug de 2 caracteres', () => {
    expect(isValidSlug('ab')).toBe(false);
  });

  it('rechaza slug de más de 40 caracteres', () => {
    expect(isValidSlug('a'.repeat(41))).toBe(false);
  });

  it('rechaza mayúsculas', () => {
    expect(isValidSlug('Centro-Belleza')).toBe(false);
  });

  it('rechaza caracteres especiales', () => {
    expect(isValidSlug('centro_belleza')).toBe(false);
    expect(isValidSlug('centro.belleza')).toBe(false);
    expect(isValidSlug('centro belleza')).toBe(false);
  });

  it('rechaza empezar con guión', () => {
    expect(isValidSlug('-centro')).toBe(false);
  });

  it('rechaza terminar con guión', () => {
    expect(isValidSlug('centro-')).toBe(false);
  });

  it('rechaza palabras reservadas', () => {
    expect(isValidSlug('admin')).toBe(false);
    expect(isValidSlug('api')).toBe(false);
    expect(isValidSlug('panel')).toBe(false);
    expect(isValidSlug('auth')).toBe(false);
    expect(isValidSlug('login')).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(isValidSlug('')).toBe(false);
  });
});

describe('RESERVED_SLUGS', () => {
  it('incluye palabras críticas', () => {
    expect(RESERVED_SLUGS).toContain('admin');
    expect(RESERVED_SLUGS).toContain('api');
    expect(RESERVED_SLUGS).toContain('c');
    expect(RESERVED_SLUGS).toContain('www');
  });
});
```

- [ ] **Step 2: Correr — falla**

Run: `npm test -- slug`

Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear `src/lib/validators/slug.ts`:
```typescript
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
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm test -- slug`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/slug.ts tests/unit/validators/slug.test.ts
git commit -m "feat(validators): agregar isValidSlug con regex + RESERVED_SLUGS blocklist"
```

---

### Task D6: Validator email (wrapper de zod)

**Files:**
- Create: `tests/unit/validators/email.test.ts`, `src/lib/validators/email.ts`

- [ ] **Step 1: Escribir test**

Crear `tests/unit/validators/email.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';

describe('normalizeEmail', () => {
  it('lowercase y trim', () => {
    expect(normalizeEmail('  JUAN@Example.COM  ')).toBe('juan@example.com');
  });
});

describe('isValidEmail', () => {
  it('acepta email válido', () => {
    expect(isValidEmail('test@test.com')).toBe(true);
  });

  it('acepta con subdomain', () => {
    expect(isValidEmail('user@mail.example.com.ar')).toBe(true);
  });

  it('rechaza sin @', () => {
    expect(isValidEmail('test.com')).toBe(false);
  });

  it('rechaza sin dominio', () => {
    expect(isValidEmail('test@')).toBe(false);
  });

  it('rechaza vacío', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr — falla**

Run: `npm test -- email`

Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear `src/lib/validators/email.ts`:
```typescript
import { z } from 'zod';

const emailSchema = z.string().email();

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string | null | undefined): boolean {
  if (!input) return false;
  return emailSchema.safeParse(input.trim()).success;
}
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm test -- email`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/email.ts tests/unit/validators/email.test.ts
git commit -m "feat(validators): agregar isValidEmail wrappeando zod"
```

---

### Task D7: Utility format-ars (TDD)

**Files:**
- Create: `tests/unit/utils/format-ars.test.ts`, `src/lib/utils/format-ars.ts`

- [ ] **Step 1: Escribir test**

Crear `tests/unit/utils/format-ars.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatArs, parseArs } from '@/lib/utils/format-ars';

describe('formatArs', () => {
  it('formatea miles con punto', () => {
    expect(formatArs(15990)).toBe('$15.990');
  });

  it('formatea millones', () => {
    expect(formatArs(1000000)).toBe('$1.000.000');
  });

  it('maneja cero', () => {
    expect(formatArs(0)).toBe('$0');
  });

  it('no muestra decimales si son cero', () => {
    expect(formatArs(1000.00)).toBe('$1.000');
  });

  it('muestra decimales si existen', () => {
    expect(formatArs(1000.5)).toBe('$1.000,50');
    expect(formatArs(1000.55)).toBe('$1.000,55');
  });

  it('maneja negativos', () => {
    expect(formatArs(-500)).toBe('-$500');
  });
});

describe('parseArs', () => {
  it('parsea string formateado de vuelta a número', () => {
    expect(parseArs('$15.990')).toBe(15990);
    expect(parseArs('$1.000.000')).toBe(1000000);
    expect(parseArs('$1.000,50')).toBe(1000.5);
  });

  it('parsea sin símbolo', () => {
    expect(parseArs('15.990')).toBe(15990);
  });

  it('retorna NaN para input inválido', () => {
    expect(parseArs('abc')).toBeNaN();
  });
});
```

- [ ] **Step 2: Correr — falla**

Run: `npm test -- format-ars`

Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear `src/lib/utils/format-ars.ts`:
```typescript
/**
 * Formatea un número a pesos argentinos con separador de miles (.)
 * y decimal (,). Ej: 15990 → "$15.990", 1000.5 → "$1.000,50"
 */
export function formatArs(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const absValue = Math.abs(amount);
  const hasCents = absValue % 1 !== 0;
  const formatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(absValue);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${formatted}`;
}

/**
 * Parsea un string en formato ARS ($15.990 o 15.990,50) a número.
 * Retorna NaN si no es parseable.
 */
export function parseArs(input: string): number {
  if (!input) return NaN;
  const clean = input.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : NaN;
}
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm test -- format-ars`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/format-ars.ts tests/unit/utils/format-ars.test.ts
git commit -m "feat(utils): agregar formatArs y parseArs con locale es-AR"
```

---

### Task D8: Utility format-phone + cn + dates

**Files:**
- Create: `src/lib/utils/cn.ts`, `src/lib/utils/format-phone.ts`, `src/lib/utils/dates.ts`, `tests/unit/utils/format-phone.test.ts`, `tests/unit/utils/dates.test.ts`

- [ ] **Step 1: Crear cn.ts (sin tests — trivial)**

Crear `src/lib/utils/cn.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Escribir tests de format-phone**

Crear `tests/unit/utils/format-phone.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatPhoneDisplay } from '@/lib/utils/format-phone';

describe('formatPhoneDisplay', () => {
  it('formatea celular E.164 a display legible', () => {
    expect(formatPhoneDisplay('+5491112345678')).toBe('+54 9 11 1234-5678');
  });

  it('formatea landline E.164 a display', () => {
    expect(formatPhoneDisplay('+541145678900')).toBe('+54 11 4567-8900');
  });

  it('devuelve input si no es formato reconocido', () => {
    expect(formatPhoneDisplay('abc')).toBe('abc');
  });

  it('maneja string vacío', () => {
    expect(formatPhoneDisplay('')).toBe('');
  });
});
```

- [ ] **Step 3: Implementar format-phone**

Crear `src/lib/utils/format-phone.ts`:
```typescript
/**
 * Formatea un teléfono E.164 argentino a un display humano.
 * +5491112345678 → "+54 9 11 1234-5678"
 * +541145678900 → "+54 11 4567-8900"
 */
export function formatPhoneDisplay(input: string): string {
  if (!input) return '';
  // Celular: +549 + 2 dígitos area + 8 dígitos número
  const mobileMatch = input.match(/^\+549(\d{2,4})(\d{4})(\d{4})$/);
  if (mobileMatch) {
    return `+54 9 ${mobileMatch[1]} ${mobileMatch[2]}-${mobileMatch[3]}`;
  }
  // Landline: +54 + 2-4 dígitos area + resto
  const landlineMatch = input.match(/^\+54(\d{2,4})(\d{4})(\d{4})$/);
  if (landlineMatch) {
    return `+54 ${landlineMatch[1]} ${landlineMatch[2]}-${landlineMatch[3]}`;
  }
  return input;
}
```

- [ ] **Step 4: Correr tests format-phone**

Run: `npm test -- format-phone`

Expected: PASS.

- [ ] **Step 5: Escribir tests de dates**

Crear `tests/unit/utils/dates.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatDateAr, formatDateTimeAr, AR_TIMEZONE } from '@/lib/utils/dates';

describe('AR_TIMEZONE', () => {
  it('es America/Argentina/Buenos_Aires', () => {
    expect(AR_TIMEZONE).toBe('America/Argentina/Buenos_Aires');
  });
});

describe('formatDateAr', () => {
  it('formatea fecha a DD/MM/YYYY', () => {
    const date = new Date('2026-04-23T15:30:00Z');
    expect(formatDateAr(date)).toBe('23/04/2026');
  });

  it('acepta string ISO', () => {
    expect(formatDateAr('2026-12-31T10:00:00Z')).toBe('31/12/2026');
  });

  it('retorna string vacío para input inválido', () => {
    expect(formatDateAr('')).toBe('');
    expect(formatDateAr('not-a-date')).toBe('');
  });
});

describe('formatDateTimeAr', () => {
  it('formatea a DD/MM/YYYY HH:mm', () => {
    const date = new Date('2026-04-23T15:30:00-03:00'); // 15:30 AR
    expect(formatDateTimeAr(date)).toBe('23/04/2026 15:30');
  });
});
```

- [ ] **Step 6: Implementar dates**

Crear `src/lib/utils/dates.ts`:
```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';

export const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

function toDate(input: Date | string): Date | null {
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'string' && input) {
    const parsed = parseISO(input);
    return isValid(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Formatea una fecha (Date o string ISO) a DD/MM/YYYY en timezone AR.
 */
export function formatDateAr(input: Date | string): string {
  const date = toDate(input);
  if (!date) return '';
  return formatInTimeZone(date, AR_TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Formatea una fecha a DD/MM/YYYY HH:mm en timezone AR.
 */
export function formatDateTimeAr(input: Date | string): string {
  const date = toDate(input);
  if (!date) return '';
  return formatInTimeZone(date, AR_TIMEZONE, 'dd/MM/yyyy HH:mm');
}
```

- [ ] **Step 7: Correr tests de dates**

Run: `npm test -- dates`

Expected: PASS.

- [ ] **Step 8: Correr TODOS los tests**

Run: `npm test`

Expected: TODO verde. Conteo aproximado: ~45 tests entre validators + utils + sample.

- [ ] **Step 9: Verificar build completo**

Run: `npm run build`

Expected: pasa sin errores.

- [ ] **Step 10: Commit**

```bash
git add src/lib/utils/ tests/unit/utils/
git commit -m "feat(utils): agregar cn, formatPhoneDisplay y helpers de fechas con timezone AR"
```

---

## Phase E — Cleanup y README

### Task E1: Crear README.md inicial

**Files:**
- Create: `README.md`

- [ ] **Step 1: Crear README**

Contenido completo:
```markdown
# appestetika

SaaS de gestión para centros de estética argentinos. Proyecto en desarrollo.

## Stack

- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3.4
- Supabase (Postgres + Auth + Storage)
- Vitest para testing

## Requisitos

- Node.js 20 LTS
- Docker Desktop (para Supabase local)
- npm 10+

## Setup local

```bash
# Instalar deps
npm install

# Levantar Supabase local (requiere Docker)
npm run db:start

# Copiar .env.example a .env.local y completar con los keys que muestra db:status
cp .env.example .env.local
npm run db:status  # muestra anon key + service_role key

# Regenerar types después de cambios de schema
npm run db:types

# Dev server
npm run dev
```

## Scripts

- `npm run dev` — Next dev server en http://localhost:3000
- `npm run build` — build de producción
- `npm test` — correr tests unitarios
- `npm run test:watch` — tests en watch mode
- `npm run db:start` / `db:stop` — controlar Supabase local
- `npm run db:reset` — aplicar todas las migraciones desde cero
- `npm run db:types` — regenerar `src/types/database.ts`

## Estructura

Ver [docs/superpowers/specs/](./docs/superpowers/specs/) para la spec del Sprint en curso.

## Estado

Sprint 1a — Core Infrastructure (en desarrollo).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: agregar README con setup local y scripts"
```

---

### Task E2: Crear PROGRESS.md y actualizar con estado

**Files:**
- Create: `docs/PROGRESS.md`

- [ ] **Step 1: Crear PROGRESS.md**

Contenido:
```markdown
# Progress Log — appestetika

Bitácora de progreso por sprint. Actualizar al cierre de cada sesión de trabajo.

## Sprint 1 — Foundations

### Plan 1a — Core Infrastructure (COMPLETO)

**Fecha**: 2026-04-23

**Hecho**:
- Scaffolding Next 14 + TypeScript + Tailwind con paleta brand/gold
- Supabase local corriendo con migraciones aplicadas
- Schema completo: organizations, memberships, services, resources, clients, business_hours, invitations
- Indexes con pg_trgm para fuzzy search de clientas
- RLS policies multi-tenant con helpers user_org_ids / user_is_org_admin
- Trigger on_auth_user_created (crea org + owner O respeta invitación)
- Bucket organization-logos con policies
- Supabase clients (server / client / middleware / admin)
- Middleware stub (refresh de sesión, auth logic viene en 1b)
- Validators: CUIT, phone-AR, DNI, slug (con blocklist), email
- Utils: cn, formatArs, formatPhoneDisplay, dates con timezone AR
- ~45 tests unitarios verdes

**Pendiente Sprint 1**:
- Plan 1b: design system (shadcn fork) + auth pages + onboarding wizard
- Plan 1c: layout panel + CRUD 4 entidades + invitations UI + integration tests + deploy Vercel
```

- [ ] **Step 2: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: agregar PROGRESS.md con estado de Plan 1a"
```

---

### Task E3: Verificación final

**Files:**
- Ninguno (solo verificación)

- [ ] **Step 1: Correr todos los tests**

Run: `npm test`

Expected: todo verde.

- [ ] **Step 2: Correr build de producción**

Run: `npm run build`

Expected: pasa sin errores ni warnings de TypeScript.

- [ ] **Step 3: Correr lint**

Run: `npm run lint`

Expected: pasa o solo warnings menores sobre archivos placeholder.

- [ ] **Step 4: Verificar Supabase local sigue corriendo**

Run: `npm run db:status`

Expected: muestra el stack activo.

- [ ] **Step 5: Verificar estado de git**

Run: `git log --oneline`

Expected: ver la secuencia completa de commits del Plan 1a (aprox 20+ commits).

Run: `git status`

Expected: `nothing to commit, working tree clean`.

---

## Acceptance criteria — Plan 1a

El Plan 1a se considera **completo** cuando:

- [ ] `npm run build` pasa sin errores
- [ ] `npm test` pasa con todos los tests verdes (~45 tests)
- [ ] `npm run lint` pasa
- [ ] `npm run db:status` muestra stack local activo
- [ ] Abrir Supabase Studio muestra las 7 tablas públicas + bucket `organization-logos`
- [ ] Crear un usuario de prueba desde Studio → Authentication dispara el trigger y crea org + membership owner
- [ ] `src/types/database.ts` contiene types para las 7 tablas
- [ ] Git log muestra commits claros en español por cada task

Cuando todos los checks estén verdes, arrancar **Plan 1b** (auth + design system + onboarding).

---

## Self-Review Checklist

Esta sección la completa Claude al terminar de escribir el plan:

### 1. Spec coverage

Cobertura del spec `docs/superpowers/specs/2026-04-23-sprint-1-foundations-design.md` para Plan 1a:
- Sección 3 Arquitectura (3.1-3.5): **cubierto** en Phase A (scaffold) + B (Supabase clients + middleware stub)
- Sección 4 Data model (4.1-4.5): **cubierto** en Phase C (migraciones 1-6 + types gen en C7)
- Sección 10 Env vars: **cubierto** en Task A6
- Sección 11 Interfaz AFIP: **postergado a Plan 1b** (es más útil tenerlo al lado de la UI de configuración)
- Sección 12.1 Unit tests (validators + utils): **cubierto** en Phase D
- Secciones 5, 6, 7, 8, 9: **postergadas a Plan 1b y 1c** (auth/onboarding/CRUD)
- Sección 12.2 Integration tests: **postergada a Plan 1c** (necesita UI completa)

### 2. Placeholder scan

- [x] Sin "TBD", "TODO", "implement later"
- [x] Todas las funciones muestran código completo, no descripciones
- [x] Commits con mensajes concretos, no genéricos
- [x] Tests con casos específicos, no "write tests for the above"

### 3. Type consistency

- [x] `createClient()` se usa consistentemente en `server.ts` y `client.ts` (nombre distinto para admin: `createAdminClient`)
- [x] `Database` type importado desde `@/types/database` en todos los clients
- [x] `normalizeCuit` / `isValidCuit` exports usados en test y production code coinciden
- [x] Schemas SQL usan nombres consistentes con types generados (snake_case en DB, auto-mapped a TypeScript)

---

## Execution Handoff

**Plan 1a completo y guardado en `docs/superpowers/plans/2026-04-23-sprint-1a-core-infra-plan.md`.**

Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — Dispatcheo un subagent fresh por task (o grupo chico de tasks), reviso entre tasks, iteración rápida. Mejor para controlar calidad con un sprint grande como este.

**2. Inline Execution** — Ejecuto los tasks en esta misma sesión usando executing-plans, batch con checkpoints cada X tasks.

¿Cuál preferís? Si elegís subagent-driven, el primer batch que sugiero es Phase A completa (6 tasks de scaffolding). Si inline, arrancamos por Task A1 y paramos en checkpoints naturales cada ~5-6 tasks.
