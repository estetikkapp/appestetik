# Progress Log — appestetika

Bitácora de progreso por sprint. Actualizar al cierre de cada sesión de trabajo.

## Estado actual: 🟢 LIVE en producción

🔗 https://appestetika.vercel.app

| Componente | Estado |
|---|---|
| GitHub repo | https://github.com/estetikkapp/appestetik |
| Auto-deploy via GitHub App | ✅ |
| Supabase cloud (us-west-2) | ✅ ACTIVE |
| Vercel production | ✅ |
| Migraciones aplicadas | ✅ 8 migrations |

---

## Sprint 1 — Foundations ✅

Mergeado y live. Detalles en commits anteriores:
- Plan 1a: scaffolding + schema + auth + onboarding + CRUD básico
- Plan 1b+1c: design system + auth pages + middleware + panel + CRUD completo
- Logo upload + edit configuración

## Sprint 2 — Agenda ✅ (parcial)

Mergeado y live:
- Migration appointments + schedule_blocks
- Day view del calendario
- Crear turno con conflict detection
- State transitions (confirm, checkin, complete, cancel, no_show)
- Página pública /c/[slug] con form de reserva

**Pendiente Sprint 2** (próxima iteración):
- Week / month view del calendar
- Drag-and-drop
- Slot picker real con disponibilidad calculada
- Lista de espera (waitlist_entries existe en DB)

## Sprint 4 — Ficha clínica + Paquetes ✅

Mergeado y live:
- Migration: `client_medical_info`, `treatment_sessions`, `packages`,
  `client_packages`, `waitlist_entries`, `payments`, `invoices`,
  `skin_analyses`, `treatment_protocols`, `loyalty_points`
- Storage buckets: `client-photos`, `skin-analyses`, `consents`
- **Ficha clínica completa** en `/clientas/[id]`:
  - Tab Datos médicos (alergias, medicaciones, embarazo, fototipo)
  - Tab Sesiones (registro con fotos antes/después + parámetros JSON)
  - Tab Paquetes (asignar paquetes y ver activos)
  - Tab Turnos (historial)
  - Tab Consentimiento (firma canvas + storage)
- **Warning visual** de contraindicaciones en banner rojo
- **Paquetes/bonos** en `/paquetes`: CRUD completo, asignar a clienta con
  cálculo auto de fecha de vencimiento

**Pendiente Sprint 4** (necesita decisión + creds):
- AFIP integration con TusFacturas (`afip_provider` + `afip_config` ya en schema)
- Generación de PDFs con react-pdf
- Notas de crédito

## Sprint 5 — IA ✅ (stubbed)

Código completo en `/ia`. Necesita `ANTHROPIC_API_KEY` en Vercel para activar.

- **Diagnóstico de piel**: upload foto + edad + objetivo → Claude Vision
  analiza scores (hidratación, manchas, arrugas, etc.) + recomienda
  servicios del catálogo
- **Generador de protocolos**: objetivo + presupuesto + disponibilidad
  → Claude genera protocolo en 3 fases con cronograma y precio total
- Tablas `skin_analyses` y `treatment_protocols` ya populadas al ejecutar
- Banner informativo si key no cargada

**Para activar**: Vercel → Project Settings → Environment Variables →
agregar `ANTHROPIC_API_KEY` con valor real → redeploy.

## Sprint 3 — Cobros ✅ (parcial, MP stubbed)

Mergeado y live:
- `/cobros`: lista de payments + forms para pago manual + link MP
- Pago manual (efectivo/transferencia/MP presencial) funciona end-to-end
- Link de MP requiere `MP_ACCESS_TOKEN`
- Webhook `/api/webhooks/mp` listo para recibir notificaciones de MP
- Banner informativo si MP no configurado

**Pendiente Sprint 3**:
- WhatsApp Business API (deferred según user)
- Plantillas de mensajes + recordatorios automáticos
- Conciliación diaria

## Sprint 6 — Polish + Growth ⏳

Hecho:
- **Dashboard real con KPIs**: facturación mes, ausentismo, top servicios,
  clientas nuevas, turnos hoy

Pendiente:
- Reportes exportables CSV/Excel
- Fidelización (puntos) — tabla `loyalty_points` ya en DB
- Campañas automáticas (depende de Sprint 3 WhatsApp)
- Widget embebible

---

## Variables de entorno

| Variable | Estado | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Real | `https://wlvlhiosyzyeqhyabcnx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Real | Configurado |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Real | Configurado |
| `NEXT_PUBLIC_APP_URL` | ✅ Real | `https://appestetika.vercel.app` |
| `ANTHROPIC_API_KEY` | ⏳ Placeholder | Cargar para activar IA |
| `MP_ACCESS_TOKEN` | ⏳ Placeholder | Cargar para activar Mercado Pago |
| `WABA_*` | ❌ No cargadas | WhatsApp deferred |
| `TUSFACTURAS_*` | ❌ No cargadas | AFIP requiere cuenta TusFacturas |

## Cómo activar features pendientes

### Mercado Pago
1. Crear cuenta MP de la organización (si no tienen)
2. Dashboard MP → Aplicaciones → Crear → obtener `Access Token` de producción
3. Vercel → appestetika → Settings → Environment Variables → editar `MP_ACCESS_TOKEN`
4. Configurar URL de webhook en MP Dashboard: `https://appestetika.vercel.app/api/webhooks/mp`
5. Redeploy

### Claude IA
1. Anthropic Console → API Keys → crear key
2. Vercel → editar `ANTHROPIC_API_KEY`
3. Redeploy

### AFIP (TusFacturas)
1. Cuenta en tusfacturas.app
2. Configurar certificado AFIP allá
3. Obtener API_KEY + API_TOKEN + USER_TOKEN
4. Vercel → cargar `TUSFACTURAS_*` env vars
5. Adaptar `lib/integrations/afip/manual.ts` → crear `tusFacturas.ts` impl
6. Redeploy
