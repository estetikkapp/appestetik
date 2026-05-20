# Cómo agregar un plan nuevo (ej. Centro)

Este doc explica cómo activar un plan adicional (típicamente el "Centro"
para cadenas multi-sucursal) cuando sea momento de habilitarlo. La
arquitectura está diseñada para que sea **una decisión declarativa**: no
hace falta migration SQL, ni endpoints nuevos, ni refactor de servicios.
Solo editar config y prender una flag.

## Checklist

### 1) Editar `src/lib/plans/definitions.ts`

El plan Centro ya está esqueletado con `available_in_ui: false`. Cambiar:

```ts
centro: {
  id: 'centro',
  name: 'Centro',
  tagline: '...',
  available_in_ui: true,                  // ← cambiar a true
  price_monthly_ars: 99990,               // ← poner precio definitivo
  price_yearly_ars: 999900,
  yearly_free_months: 2,
  limits: {
    users: null,                          // null = ilimitado (mantener o ajustar)
    ai_skin_diagnosis_per_month: null,
    ai_protocol_per_month: null,
  },
  features: {
    multi_usuario: true,
    dashboard_empleadas: true,
    comisiones: true,
    inventario: true,
    reportes_avanzados: true,
    soporte_prioritario: true,
    // si se agregan features nuevas exclusivas de centro (ej. multi_sucursal,
    // api_access, account_manager) sumar a `FeatureFlag` type y al feature
    // record de TODOS los planes (con false en gabinete/equipo).
  },
  description_long: '...',
  description_features_yes: [
    'Todo lo de Equipo +',
    'Multi-sucursal',
    'Usuarios ilimitados',
    // ...
  ],
},
```

Eso es lo único obligatorio para que el plan **aparezca en la página /precios
y en el plan picker del onboarding**.

### 2) Si tiene features NUEVAS no compartidas, agregar en 2 lugares

Ejemplo: agregás `multi_sucursal`. Necesita:

a) Sumar al `FeatureFlag` type:

```ts
export type FeatureFlag =
  | 'multi_usuario'
  | 'dashboard_empleadas'
  | 'comisiones'
  | 'inventario'
  | 'reportes_avanzados'
  | 'soporte_prioritario'
  | 'multi_sucursal'; // ← nuevo
```

b) Setear el flag en `features` de **todos los planes**:

```ts
gabinete: { features: { ..., multi_sucursal: false } },
equipo:   { features: { ..., multi_sucursal: false } },
centro:   { features: { ..., multi_sucursal: true } },
```

c) Si la feature corresponde a una página, agregar el `requireFeature`:

```ts
// src/app/(panel)/sucursales/page.tsx
await requireMembership({ minRole: 'admin' });
await requireFeature('multi_sucursal');
```

d) Mapear el `from=` del banner en `/precios`:

```ts
// src/app/precios/page.tsx → FEATURE_REASONS
const FEATURE_REASONS: Record<string, string> = {
  // ...
  multi_sucursal: 'La gestión multi-sucursal está en el plan Centro.',
};
```

### 3) Configurar precios en MP (manual)

Si se cobra mensual, no hay setup adicional — el código crea preapprovals
ad-hoc.

Si se cobra anual o si vas a usar Checkout Pro con productos pre-creados,
crear los items en el panel de MP de appestetika (no es obligatorio:
nuestro flujo crea preferences ad-hoc).

### 4) Tests

Agregar casos en `tests/unit/plans/`:

- `feature-flags.test.ts`: verificar `canAccessFeature('centro', ...)` para
  cualquier feature nueva.
- `billing-calculations.test.ts`: verificar `getUpgradeChargeAmount` entre
  Equipo → Centro.
- `ai-quota-service.test.ts`: si Centro es ilimitado, verificar que
  `total_available` sea null.

### 5) UI: opcional

Si querés un layout especial (ej. tarjeta destacada en /precios), tocar
`src/app/precios/page.tsx`. La función `PlanCard` está hardcoded para 2
columnas — para 3 planes, cambiar `md:grid-cols-2` a `md:grid-cols-3`.

## Lo que NO hace falta tocar

- ❌ Migration SQL — `plan_id` es `text` libre en `plan_subscriptions`, ya
  acepta cualquier ID. No hay CHECK constraint.
- ❌ Tipos DB — `plan_subscriptions.plan_id` es `string`, no enum.
- ❌ SubscriptionService — agnóstico del plan ID. Ya soporta upgrade
  Equipo → Centro y downgrade Centro → Equipo via `getPlanRank`.
- ❌ AIQuotaService — ya maneja `plan_limit: null` como ilimitado.
- ❌ Webhooks MP — el flujo es agnóstico del plan_id.

## Backfill de orgs existentes (si aplica)

Si querés migrar a algunas clínicas existentes al plan Centro (ej. cuando
abran sucursales), usar el endpoint normal de upgrade o un script:

```sql
update plan_subscriptions
set plan_id = 'centro'
where organization_id in ('uuid-1', 'uuid-2');
```

Para mantener trazabilidad, mejor crear una fila en `plan_change_events`
antes del UPDATE (ya lo hace el endpoint `/api/subscriptions/upgrade` —
preferir ese camino cuando sea posible).

## Cómo testear localmente antes de prender en prod

1. En local, `available_in_ui: true` solo en `centro`.
2. Setear plan_id='centro' en una org de test via SQL directo.
3. Verificar que las features se desbloquean.
4. Probar upgrade Equipo → Centro desde la UI.
5. Mergear el cambio, deployar, anunciar.
