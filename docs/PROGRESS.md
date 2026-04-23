# Progress Log — appestetika

Bitácora de progreso por sprint. Actualizar al cierre de cada sesión de trabajo.

## Sprint 1 — Foundations

### Plan 1a — Core Infrastructure ✅

**Fecha**: 2026-04-23
**Branch**: mergeada a master
**Estado**: Código completo. Pendiente aplicar migraciones contra DB real.

**Hecho**:
- Scaffolding Next 14 + TypeScript strict + Tailwind con paleta brand/gold
- Dependencias: Supabase SSR, zod, react-hook-form, date-fns, lucide, sonner, Radix UI
- Supabase CLI + 6 migraciones SQL (schema + indexes + RLS + trigger + storage)
- Supabase clients (server/client/middleware/admin) tipados con Database
- Middleware stub
- 5 validators + 4 utils con TDD (73 tests verdes)
- `src/types/database.ts` crafteado manualmente

### Plan 1b+1c — UI completa ✅

**Fecha**: 2026-04-23
**Branch**: `feat/sprint-1bc-ui-auth-crud`
**Estado**: Código completo. Pendiente DB + Vercel para habilitar runtime.

**Hecho**:
- **Design system** (18 componentes, fork de shadcn/ui adaptado a brand/gold):
  - Primitives: Button, Input, Label, Textarea, Form (RHF+zod wrapper), Toaster (sonner)
  - Overlays: Dialog, Sheet, Select, Checkbox, RadioGroup, Switch, DropdownMenu
  - Contenido: Table, Badge, Avatar, Separator
- **Auth**:
  - `/auth/login`, `/auth/signup`, `/auth/callback` con Server Actions
  - Google OAuth + errores traducidos al español
- **Middleware completo**: redirects por onboarding/owner/active_org + cookie de org activa
- **Onboarding wizard** (4 pasos con Server Actions):
  - Paso 1 fiscal (CUIT, condición IVA, display_name)
  - Paso 2 horarios (7 días con defaults)
  - Paso 3 primer servicio
  - Paso 4 presencia (slug público con validación)
- **Panel layout**:
  - Sidebar responsive con nav + active state
  - Header con OrgSwitcher (multi-org) + UserMenu (dropdown con logout)
  - Dashboard placeholder con stats + trial days banner
- **CRUD completo** (4 entidades):
  - Servicios: list + sheet drawer + archive + filtros
  - Recursos: list + sheet drawer + archive con tipos predefinidos
  - Clientas: list + search server-side (ilike) + sheet drawer + validators AR
  - Empleadas: list + invitar via `supabase.auth.admin.inviteUserByEmail` +
    revocar invitaciones + toggle active
- **Configuración**: página readonly con datos de org + estado de integraciones
- **AFIP**: interface `IAfipProvider` + `ManualAfipProvider` stub con `NotImplementedError`
- **Seed**: función SQL `seed_demo_data(org_id)` con 6 servicios, 4 recursos, 5 clientas demo

**Pendiente para habilitar runtime**:
1. Instalar Docker Desktop **o** crear proyecto cloud en supabase.com
2. Aplicar migraciones (`npm run db:reset` local o `supabase link + db push` cloud)
3. Regenerar `src/types/database.ts` con `npm run db:types` (sobreescribe el manual)
4. Completar `.env.local` con las keys reales de Supabase
5. Test manual end-to-end:
   - Signup → trigger crea org + owner membership
   - Completar wizard onboarding
   - Crear servicio/recurso/clienta/invitar empleada
6. Deploy a Vercel staging (próximo paso)

**Pendiente de Sprint 1 (funcionalidades a postergar)**:
- Upload de logo en onboarding paso 4 (estructura lista, falta hookear a Supabase Storage)
- Edición de configuración desde panel (por ahora solo readonly)
- Integration tests (signup flow + tenant isolation) — requiere DB corriendo

## Sprint 2 — Agenda (planeado)

- Calendario día/semana/mes con drag-and-drop
- Vista por profesional / cabina / general
- Creación de turnos + estados + check-in
- Página pública de reservas `/c/[slug]`
- Componentes Calendar + DatePicker + TimePicker

## Sprint 3+ — Ver [docs/superpowers/specs/](./superpowers/specs/)
