---
title: Sprint 1 — Foundations
date: 2026-04-23
sprint: 1
project: appestetika
status: draft (pending user review)
---

# Sprint 1 — Foundations

## 1. Contexto

Greenfield. Este sprint deja lista la base técnica de **appestetika** (SaaS de gestión para centros de estética argentinos) que todos los sprints posteriores asumen como dada: app Next 14 con route groups, Supabase multi-tenant con RLS, auth, wizard de onboarding, y CRUD básico de las entidades core.

El objetivo al cerrar Sprint 1: que un usuario pueda crear su cuenta, completar el onboarding de su centro, cargar servicios/recursos/clientas, e invitar empleadas. El dashboard de agenda y las vistas de calendario quedan para Sprint 2.

## 2. Scope

### Incluido
- Scaffolding Next 14 App Router + Tailwind + TypeScript + Supabase SSR
- Schema de BD con RLS para 7 tablas core
- Supabase Auth (email/pass + Google OAuth)
- Trigger `on_auth_user_created` que genera organización + membership owner
- Wizard de onboarding lineal de 4 pasos
- CRUD (alta/edición/baja soft) de: servicios, recursos, clientas, empleadas
- Invitación mínima de empleadas por email con token one-time
- Design system inicial (fork de shadcn/ui adaptado a paleta rosa/nude/dorado)
- Validators centralizados (CUIT con dígito verificador, teléfono AR, DNI, email, slug)
- Interfaz `IAfipProvider` sin implementación real (impl completa en Sprint 4)
- Deploy a Vercel con preview por PR

### Explícitamente fuera
- Calendario / agenda (Sprint 2)
- Página pública de reservas `/c/[slug]` (Sprint 2)
- WhatsApp integration (Sprint 3)
- Mercado Pago (Sprint 3)
- AFIP / facturación real — solo interfaz, implementación en Sprint 4
- Ficha clínica / consentimientos informados (Sprint 4)
- Features de IA (Sprint 5)
- App mobile nativa (no va en v1, solo PWA)

## 3. Arquitectura

### 3.1 Estructura Next 14

Una sola app con tres superficies separadas por route groups:
- `app/(panel)/*` — panel profesional autenticado
- `app/(public)/*` — landing y páginas de marketing/legales
- `app/c/[slug]/*` — reservas públicas por centro (contenido real en Sprint 2)

### 3.2 Multi-tenancy

Row-level con columna `organization_id` en toda tabla tenant-specific. Para Sprint 1 las RLS policies usan subquery a `memberships`:

```sql
create policy "tenant isolation" on clients
  for all using (
    organization_id in (
      select organization_id from memberships
      where user_id = auth.uid() and active = true
    )
  );
```

En Sprint 2+ migraremos a un **JWT custom claim** (`organization_id` inyectado vía Supabase Auth Hook) para evitar el subquery en hot paths. Para el volumen de datos del MVP el subquery es suficiente y más simple de razonar.

Para el caso multi-org (una persona en 2+ centros), el usuario elige "organización activa" en la UI. Guardamos en cookie `active_org` leída por middleware, que valida contra `memberships` en cada request. Default al único membership si solo tiene uno.

### 3.3 Stack de dependencias

Alineado con `C:\Users\Tomi\Desktop\SAS PARA SERVICIOS` (stack ya probado):

| Librería | Versión | Razón |
|---|---|---|
| next | ^14.2.35 | App Router, mismo que SERVICIOS |
| react + react-dom | ^18 | Stable con App Router |
| @supabase/ssr | ^0.10.2 | Server components + middleware |
| @supabase/supabase-js | ^2.103.0 | Client SDK |
| tailwindcss | ^3.4.1 | Design system |
| typescript | ^5 | Types everywhere |
| zod | ^3.23 | Validators + schemas |
| react-hook-form | ^7.52 | Forms con zod resolver |
| @hookform/resolvers | ^3.6 | Integración RHF + zod |
| date-fns | ^3.6 | Fechas lightweight |
| date-fns-tz | ^3.1 | Timezone (AR fijo en v1) |
| @radix-ui/react-* | última | Base de shadcn/ui |
| lucide-react | ^1.8.0 | Iconos (mismo que SERVICIOS) |
| clsx + tailwind-merge | última | cn() helper |
| sonner | última | Toasts |

A postergar:
- `@anthropic-ai/sdk` → Sprint 5
- `mercadopago` → Sprint 3
- `@react-pdf/renderer` → Sprint 4

### 3.4 Supabase clients

Cuatro entrypoints siguiendo el patrón de `@supabase/ssr`:
- `lib/supabase/server.ts` — Server Components (con cookies)
- `lib/supabase/client.ts` — Client Components
- `lib/supabase/middleware.ts` — helper para Next middleware
- `lib/supabase/admin.ts` — service role key, uso restringido a rutas backend específicas

### 3.5 Deploy

Vercel con preview por PR. Variables en Vercel para staging/prod, `.env.local` para dev. GitHub Actions opcional para correr tests antes del merge.

## 4. Data model

### 4.1 Tablas Sprint 1

```sql
create table organizations (
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

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'professional', 'receptionist')),
  display_name text,
  commission_rate numeric(5,2) default 0,
  active boolean not null default true,
  invited_by uuid references auth.users(id),
  invitation_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
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

create table resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
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

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  active boolean not null default true,
  unique (organization_id, day_of_week),
  check ((active = false) or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'professional', 'receptionist')),
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

### 4.2 Índices

- `clients`: `pg_trgm` gin index en `full_name`, btree en `phone_e164` y `dni`, compuesto `(organization_id, created_at desc)` para listados
- `services`, `resources`: compuesto `(organization_id, active)`
- `memberships`: `(user_id, active)` y `(organization_id, active)`
- `invitations`: btree en `token` (unique ya existe) y `(email, organization_id)` para evitar duplicados lógicos

### 4.3 RLS policies

**Política general**: cada tabla tenant-specific filtra por `organization_id IN (select organization_id from memberships where user_id = auth.uid() and active = true)`.

**Memberships**: el user ve sus propios memberships (por `user_id = auth.uid()`). Owner/admin de una org ve todos los memberships de esa org.

**Matriz de permisos Sprint 1** (simplificada — se refina en Sprint 3 con appointments):

| Tabla | Owner | Admin | Professional | Receptionist |
|---|---|---|---|---|
| organizations | SELECT/UPDATE | SELECT/UPDATE | SELECT | SELECT |
| memberships | ALL | ALL menos delete owner | SELECT propio | SELECT propio |
| services | ALL | ALL | SELECT | SELECT |
| resources | ALL | ALL | SELECT | SELECT |
| clients | ALL | ALL | SELECT | SELECT/INSERT/UPDATE |
| business_hours | ALL | ALL | SELECT | SELECT |
| invitations | ALL | ALL | — | — |

### 4.4 Trigger `on_auth_user_created`

```sql
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
  new_org_id uuid;
begin
  -- Si el signup viene de una invitación, leer el token del user metadata
  if new.raw_user_meta_data->>'invitation_token' is not null then
    select id, organization_id, role
    into pending_invitation_id, invitation_org_id, invitation_role
    from public.invitations
    where token = new.raw_user_meta_data->>'invitation_token'
      and accepted_at is null
      and expires_at > now()
      and lower(email) = lower(new.email);

    if pending_invitation_id is not null then
      insert into public.memberships (user_id, organization_id, role, invitation_accepted_at, invited_by)
      values (new.id, invitation_org_id, invitation_role, now(),
              (select invited_by from public.invitations where id = pending_invitation_id));

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

### 4.5 Storage

Bucket `organization-logos` (privado, signed URL). Path: `{organization_id}/logo.{ext}`. Policy: owner/admin pueden read/write los archivos de su org.

## 5. Auth flow

1. **Signup** (email/pass o Google):
   - Si viene de link de invitación, se pre-fillea el email y se agrega `invitation_token` al `raw_user_meta_data` para que el trigger lo procese
   - Sino, signup normal → trigger crea org + membership owner

2. **Middleware** (`src/middleware.ts`) — reglas en orden:
   - Rutas `(panel)` sin sesión → redirect `/auth/login`
   - Rutas `/auth/login` o `/auth/signup` con sesión: si la org activa está onboarded → `/panel`; si no → `/onboarding`
   - Resolver `active_org`: leer cookie `active_org`, validar contra memberships activos del user; si inválida/ausente, fallback al `memberships.created_at desc` más reciente; si cero memberships, forzar logout (estado inválido)
   - Si la org activa tiene `onboarded_at IS NULL` Y el user es `owner` Y ruta ≠ `/onboarding/*` → redirect `/onboarding`
   - Si la org activa tiene `onboarded_at IS NULL` Y el user NO es `owner` → mostrar página "Tu centro todavía se está configurando. Contactá al owner." (no puede usar el panel hasta que el owner complete onboarding)
   - Logout siempre permitido desde cualquier ruta autenticada

3. **Logout**: clear session, clear cookie `active_org`, redirect a `/auth/login`

4. **OAuth callback**: `/auth/callback/route.ts` intercambia code por session y redirige; middleware se encarga del resto según estado.

5. **Edge case multi-org con onboarding pendiente**: si user creó su propia org (no onboarded) y después acepta invitación a otra org (ya onboarded), al iniciar sesión `active_org` default es la más reciente (la invitada). User puede switchear con OrgSwitcher y completar el onboarding de la suya cuando quiera.

## 6. Onboarding wizard

Ruta: `/onboarding` dentro de `(panel)`. No dismissable. Layout simple sin nav lateral, full-width centrado, progreso 1/4 → 4/4.

Estado: persistido en DB en cada paso (no localStorage), así no se pierde si recarga.

### Paso 1 — Identidad y datos fiscales
- **Nombre del centro** (escribe sobre `organizations.name`)
- **Tu nombre** (guarda en `memberships.display_name`)
- **Nombre legal / Razón social** (opcional, `organizations.legal_name`)
- **CUIT** (input con máscara XX-XXXXXXXX-X, validación de dígito verificador en blur)
- **Condición IVA**: radio (monotributo / responsable inscripto / exento)

### Paso 2 — Horarios de atención
- Grilla 7 días (Lun, Mar, Mié, Jue, Vie, Sáb, Dom — orden argentino)
- Por cada día: switch "Abierto" + dos time pickers (abre/cierra) que se habilitan solo si está abierto
- Botón "Aplicar Lun-Vie a todos" para acelerar
- **Defaults**: Lun-Vie 9:00-19:00, Sáb 9:00-13:00, Dom cerrado
- Submit crea/actualiza 7 filas en `business_hours`

### Paso 3 — Primer servicio
- **Nombre** (ej. "Limpieza facial profunda")
- **Categoría**: select con opciones (depilación, facial, corporal, uñas, masajes, otro)
- **Duración** en minutos (input numérico)
- **Precio en pesos** (input con formato ARS — mostrar `$15.990` mientras escribe)

### Paso 4 — Presencia
- **Logo** (drag-and-drop o click, upload a bucket `organization-logos`, preview circular)
- **Slug público**: input con validación en dos capas
  - Client-side (inmediata): regex `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$` (3-40 chars, lowercase, alfanumérico + guiones, no empieza/termina con guión)
  - Client-side: blocklist literal: `admin`, `api`, `panel`, `auth`, `c`, `public`, `login`, `signup`, `onboarding`, `invitations`, `app`, `www`, `help`, `about`, `terms`, `privacy`
  - Server-side (debounce 400ms): Server Action que consulta `select 1 from organizations where slug = $1 limit 1` para validar disponibilidad
  - UI: mientras tipea muestra "Verificando…" → "Disponible ✓" o "Ya está en uso"
  - Preview en vivo: `appestetika.com.ar/c/{slug}`
- Submit final → `organizations.onboarded_at = now()` → redirect `/panel`

## 7. CRUD básico

Patrón común para las 4 entidades (servicios, recursos, clientas, empleadas):
- **Listado**: tabla responsive con filtros (active/inactive), búsqueda si aplica, paginación simple
- **Alta/edición**: drawer lateral (Sheet de Radix) — 400px en desktop, full-width en mobile
- **Baja**: soft delete (`active = false`), confirmación en dialog, nunca DELETE real en Sprint 1 para preservar integridad referencial de sprints futuros
- **Archivadas**: toggle en listado para mostrar inactivas

### Empleadas — sub-flow "Invitar"

Decisión: **usar `supabase.auth.admin.inviteUserByEmail()`** en lugar de armar email sending propio. Esto nos ahorra integrar Resend/SendGrid en Sprint 1 y aprovecha la infra de email gratuita de Supabase.

1. Owner clickea "Invitar empleada" en listado de empleadas
2. Drawer con: email + select rol (admin / professional / receptionist) + botón "Enviar invitación"
3. Server Action:
   - Genera `token` (32 chars crypto-random) e inserta fila en `invitations`
   - Llama `supabase.auth.admin.inviteUserByEmail(email, { data: { invitation_token: <token>, organization_name: <org.name> }, redirectTo: APP_URL + '/panel' })`
   - Supabase crea el user en auth.users con status invited y envía email con link a hosted page de Supabase para setear contraseña
4. User recibe email, clickea link, setea contraseña en la página de Supabase, es autenticado y redirigido a `APP_URL/panel`
5. Cuando Supabase crea el user, el trigger `handle_new_user` corre con `raw_user_meta_data.invitation_token`, detecta la invitación y crea `membership` con el rol correcto (en lugar de nueva org)
6. Middleware detecta que hay membership válido y la org ya está onboarded → lleva al `/panel`

Ventaja: no necesitamos página `/invitations/accept` propia. Desventaja: dependemos del template de email default de Supabase — se puede customizar después en el Dashboard de Supabase sin cambiar código.

### Búsqueda de clientas
- Input con debounce 300ms
- Server Action: query usando `pg_trgm` similarity en `full_name` + LIKE en `phone_e164` y `dni`
- Límite 50 resultados, cursor-based pagination si hay más

## 8. Design system

**Fork de shadcn/ui** copiando componentes on-demand (no dependency npm). Adaptamos estilos a la paleta del producto.

### Paleta en `tailwind.config.ts`

```typescript
colors: {
  brand: {
    50: '#fdf7f4',  // rosa-nude casi blanco — backgrounds
    100: '#f9ecec',
    200: '#f1d6d3',
    300: '#e5b4ad',
    400: '#d18f87',
    500: '#b96f66',  // primary — CTAs principales
    600: '#9a544d',
    700: '#7d4039',
    800: '#5e2f2b',
    900: '#42201e',
  },
  gold: {
    400: '#d4a574',
    500: '#c19360',  // secondary — CTAs premium, badges
    600: '#a57a4b',
  },
  neutral: {
    // tonos cálidos (stone de tailwind)
  },
}
```

Tipografía: **Inter para todo** en Sprint 1 (UI + landing). Evaluar agregar un serif para marketing en Sprint 6 si hace falta diferenciación visual de la landing.

### Componentes a scaffoldear en Sprint 1

`src/components/ui/`:
- `button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`
- `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`
- `dialog.tsx`, `sheet.tsx` (drawer lateral), `popover.tsx`, `tooltip.tsx`
- `table.tsx`, `tabs.tsx`, `badge.tsx`, `avatar.tsx`, `separator.tsx`
- `form.tsx` (wrapper de react-hook-form + zod + error display)
- `toaster.tsx` (sonner)

Postergados:
- `calendar.tsx`, `date-picker.tsx`, `time-picker.tsx` → Sprint 2
- Data table avanzada con sort/filter → cuando lo pida un listado real

## 9. Folder structure

```
SAS PARA CLINICAS DE ESTETICA/
├── src/
│   ├── app/
│   │   ├── (panel)/
│   │   │   ├── layout.tsx          # nav lateral + header
│   │   │   ├── page.tsx            # dashboard placeholder
│   │   │   ├── onboarding/
│   │   │   │   ├── layout.tsx      # layout simple sin nav
│   │   │   │   ├── page.tsx        # paso 1
│   │   │   │   ├── horarios/page.tsx
│   │   │   │   ├── servicio/page.tsx
│   │   │   │   └── presencia/page.tsx
│   │   │   ├── servicios/
│   │   │   ├── recursos/
│   │   │   ├── clientas/
│   │   │   ├── empleadas/
│   │   │   └── configuracion/
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # landing mínima
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── middleware.ts
│   ├── components/
│   │   ├── ui/                     # shadcn fork
│   │   ├── forms/                  # FormField, ErrorMessage
│   │   ├── layout/                 # Sidebar, Header, OrgSwitcher
│   │   └── onboarding/             # Stepper, cada paso
│   ├── lib/
│   │   ├── supabase/               # server.ts, client.ts, middleware.ts, admin.ts
│   │   ├── integrations/
│   │   │   └── afip/
│   │   │       ├── types.ts        # IAfipProvider interface
│   │   │       └── manual.ts       # placeholder "comprobante interno"
│   │   ├── validators/             # cuit.ts, phone-ar.ts, dni.ts, slug.ts, email.ts
│   │   ├── utils/
│   │   │   ├── cn.ts
│   │   │   ├── format-ars.ts
│   │   │   ├── format-phone.ts
│   │   │   └── dates.ts
│   │   └── schemas/                # zod schemas reutilizables
│   ├── types/
│   │   ├── database.ts             # generado por supabase gen types
│   │   └── app.ts                  # types manuales
│   └── actions/                    # Server Actions agrupadas por entidad
│       ├── organizations.ts
│       ├── services.ts
│       ├── resources.ts
│       ├── clients.ts
│       └── memberships.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260423000001_initial_schema.sql
│   │   ├── 20260423000002_indexes.sql
│   │   ├── 20260423000003_rls_policies.sql
│   │   ├── 20260423000004_triggers.sql
│   │   └── 20260423000005_storage_buckets.sql
│   └── seed.sql
├── tests/
│   ├── unit/
│   │   └── validators/
│   └── integration/
│       └── signup-flow.test.ts
├── docs/
│   ├── superpowers/specs/
│   │   └── 2026-04-23-sprint-1-foundations-design.md
│   ├── PROGRESS.md
│   └── README.md
├── public/
├── .env.example
├── .env.local                      # gitignored
├── .gitignore
├── .eslintrc.json
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── README.md
```

## 10. Env vars

Archivo `.env.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===== Postergados a sprints siguientes =====

# AFIP — TusFacturas (Sprint 4, crear cuenta durante ese sprint)
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

## 11. Interfaz AFIP provider

`src/lib/integrations/afip/types.ts`:

```typescript
export type InvoiceType = 'C' | 'B' | 'A';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price_ars: number;
}

export interface InvoiceRequest {
  organizationId: string;
  type: InvoiceType;
  clientId: string;
  items: InvoiceItem[];
  total_ars: number;
}

export interface InvoiceResult {
  invoice_id: string;
  cae: string | null;          // null para provider 'manual'
  cae_due_date: Date | null;
  pdf_url: string;
  is_fiscal: boolean;          // false para 'manual'
  provider_response: Record<string, unknown>;
}

export interface IAfipProvider {
  name: 'tusfacturas' | 'direct' | 'manual';
  emit(request: InvoiceRequest): Promise<InvoiceResult>;
  voidInvoice(invoiceId: string, reason: string): Promise<void>;
  fetchInvoice(invoiceId: string): Promise<InvoiceResult>;
}
```

En Sprint 1 implementamos **solo los tipos + un stub `manual.ts`** cuyos métodos tiran `NotImplementedError`. No hay cobros en Sprint 1, así que el stub nunca se ejecuta. La implementación real de `manual.ts` (PDF "comprobante interno") + `tusFacturas.ts` llega en Sprint 4 junto con `@react-pdf/renderer`. Meter solo los tipos ahora nos permite referenciarlos desde el schema (`afip_provider` enum) y tener compilación correcta.

## 12. Testing

### 12.1 Unit (Vitest)

`tests/unit/validators/`:
- `cuit.test.ts` — valida dígito verificador. Happy: `20-12345678-3`. Edge: dígito incorrecto, menos de 11 dígitos, letras, CUIT negativos (20 inválido), CUIT personas jurídicas (30).
- `phone-ar.test.ts` — normaliza a E.164. Inputs: `+541112345678`, `11 1234 5678`, `15-1234-5678` (celular viejo), `+54 9 11 1234 5678`.
- `dni.test.ts` — acepta 7 u 8 dígitos numéricos puros, rechaza: con letras, con espacios/puntos, menos de 7 o más de 8 dígitos, string vacío. Happy: `12345678`, `1234567`. Sad: `ABC12345`, `123`, `123456789`, `12.345.678`.
- `slug.test.ts` — regex + blocklist + longitud.
- `email.test.ts` — delegado a zod.

`tests/unit/utils/`:
- `format-ars.test.ts` — `15990 → "$15.990"`, `1000000 → "$1.000.000"`, `0 → "$0"`, negativos.
- `dates.test.ts` — timezone AR edge cases (sin DST en AR desde 2009 pero verificar).

### 12.2 Integration (Vitest contra Supabase local)

`tests/integration/signup-flow.test.ts`:
- Signup email/pass → verifica trigger creó org + membership owner
- Onboarding: completar los 4 pasos → verifica `onboarded_at` no null, business_hours 7 filas, service creado
- Crear clienta → buscar por nombre parcial → encuentra
- Tenant isolation: crear 2 orgs distintas, verificar que org A no ve clientes de org B con RLS activa

Script: `npm run test:int` levanta Supabase local (`supabase start`), corre vitest, tear down.

### 12.3 E2E

Postergado a Sprint 2 (con agenda interactiva hay flows reales que testear con Playwright).

## 13. Acceptance criteria

Sprint 1 se considera **completo** cuando:

- [ ] Usuario puede registrarse con email o Google
- [ ] Trigger `on_auth_user_created` crea org + membership owner en signup normal
- [ ] Trigger respeta invitación si hay token válido y crea membership con rol correcto
- [ ] Al primer login (post-signup sin onboarding), el wizard aparece y no se puede esquivar
- [ ] Wizard de 4 pasos completa sin errores, cada paso persiste en DB
- [ ] Validación de CUIT rechaza inválidos en paso 1
- [ ] Validación de slug rechaza blocklist y duplicados en paso 4
- [ ] Al completar onboarding, el panel muestra dashboard placeholder con logo y nombre del centro
- [ ] CRUD de servicios, recursos, clientas funciona (alta, edición, archivar, listar)
- [ ] Invitación de empleada: owner genera invitación, email llega con link, aceptar lleva a signup, empleada queda en la org con el rol correcto
- [ ] Tenant isolation: test manual + integration test confirman que org A no ve datos de org B
- [ ] Búsqueda de clientas funciona con nombre parcial, teléfono, y DNI
- [ ] Todos los unit tests verdes
- [ ] Integration test del happy path verde
- [ ] `npm run build` pasa sin errores ni warnings de TS
- [ ] `npm run lint` pasa
- [ ] Deploy a Vercel preview funciona y se puede completar el flow end-to-end

## 14. Decisiones diferidas

Ítems que pueden aparecer durante Sprint 1 pero que decidimos cuando lleguen, no ahora:

- **`audit_log` genérico**: postergar a Sprint 6 salvo que cubra un caso fiscal/compliance que fuerce su inclusión en Sprint 1
- **Email de invitación**: copy + diseño HTML → proponer 2-3 opciones cuando se implemente el backend de invitaciones
- **Dashboard post-onboarding**: en Sprint 1 es placeholder con "Bienvenida {nombre}" + CTA deshabilitado "Crear primer turno (disponible en Sprint 2)"
- **Seed data para dev**: crear 1 org + 1 owner + 3 servicios + 5 clientas ficticias para que la dev DB no esté vacía

## 15. Referencias

- Stack de referencia probado: `C:\Users\Tomi\Desktop\SAS PARA SERVICIOS\package.json`
- Supabase RLS best practices (evitar funciones custom en hot paths, usar `auth.uid()` directo)
- shadcn/ui docs: componentes se copian, no se instalan
- Spec maestra del producto (prompt del usuario del 2026-04-23): las 17 tablas, los 11 módulos, los 6 sprints. Este doc implementa el subset Sprint 1.

## 16. Próximo paso

Una vez aprobado este spec por el usuario, invocar la skill `superpowers:writing-plans` para generar el plan de implementación detallado con tareas ordenadas, checkpoints, y TDD donde aplique.
