# Progress Log — appestetika

Bitácora de progreso por sprint. Actualizar al cierre de cada sesión de trabajo.

## Sprint 1 — Foundations ✅

### Plan 1a — Core Infrastructure ✅
**Branch mergeada a master**. Scaffolding + dependencies + 6 migraciones SQL + Supabase clients + validators/utils con TDD (73 tests).

### Plan 1b+1c — UI completa ✅
**Branch mergeada a master**. Design system (18 componentes shadcn-fork), auth, middleware completo, onboarding wizard 4 pasos, panel con sidebar, CRUD 4 entidades, invitaciones, AFIP stub.

### Plan 1d — Logo upload + config edit ✅
**En branch actual feat/sprint-2-agenda**. Upload de logo al bucket organization-logos + edición de datos fiscales desde /configuracion.

## Sprint 2 — Agenda ⏳

**Branch**: `feat/sprint-2-agenda`
**Estado**: Core funcional listo. Calendar week/month + drag-and-drop quedan para iteraciones siguientes.

**Hecho**:
- Migration `20260423100001_appointments.sql`:
  - Enums `appointment_status` (pending/confirmed/in_progress/completed/cancelled/no_show)
  - Enum `appointment_source` (panel/public/waitlist)
  - Tabla `appointments` con FK a clients/services/resources/professional
  - Tabla `schedule_blocks` para vacaciones/mantenimiento
  - Índices compuestos para queries por rango + org
  - RLS multi-tenant con staff pueden manage appointments
  - Trigger auto-update de `clients.last_visit_at` al completar
- `actions/appointments.ts`:
  - `createAppointment` con cálculo auto de `ends_at` y detección de conflictos
    (profesional superpuesto, recurso ocupado, schedule blocks)
  - `updateAppointmentStatus` con timestamps correctos por transición
  - `createScheduleBlock` para bloqueos
- UI agenda:
  - `DayView` hora a hora con slots cada 30min, respeta business_hours
  - Badges de estado con colores por status
  - Row actions inline (confirm/checkin/complete/cancel/no-show)
  - `CreateAppointmentSheet` con selects nativos + datetime picker
  - Navegación prev/hoy/next
- Página pública `/c/[slug]`:
  - Catálogo de servicios con categoría + duración + precio
  - Card de horarios de atención
  - Form de reserva con validación teléfono AR
  - Crea clienta automática si no existe (match por phone_e164)
  - `/c/[slug]/confirmacion` como success page
- Middleware ya expone `/c/*` como público

**Pendiente Sprint 2** (iteraciones futuras):
- Calendar week view + month view
- Drag-and-drop para reagendar
- Real slot availability calculation (filtrar slots ya tomados)
- Lista de espera
- Recordatorios automáticos (requiere Sprint 3 WhatsApp)

## Para habilitar runtime

1. Supabase:
   - Docker: `npm run db:start` + `npm run db:types`
   - Cloud: `supabase link` + `supabase db push` + regenerar types
2. Vercel: cargar env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`)
3. Test manual end-to-end:
   - Signup → trigger crea org + owner
   - Completar wizard onboarding
   - Subir logo en Configuración
   - Crear servicio/recurso/clienta
   - Crear turno en Agenda con conflict detection
   - Ir a `/c/<slug>` y hacer una reserva pública
   - Ver la reserva pending en Agenda, confirmarla

## Sprints siguientes (planeados)

- **Sprint 3** — WhatsApp Business + Mercado Pago + recordatorios automáticos + webhooks
- **Sprint 4** — AFIP (TusFacturas) + ficha clínica + consentimientos digitales + paquetes
- **Sprint 5** — Feature IA #1 (diagnóstico de piel con Claude Vision) + Feature IA #2 (generador de protocolos)
- **Sprint 6** — Dashboard con KPIs + fidelización + campañas automáticas + widget embebible + tiers de suscripción
