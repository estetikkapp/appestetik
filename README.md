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
- Docker Desktop (para Supabase local) **o** cuenta en supabase.com (cloud)
- npm 10+

## Setup local

```bash
# Instalar deps
npm install

# Opción A: Supabase local (requiere Docker)
npm run db:start
npm run db:status   # muestra anon key + service_role key
# Copiar esos valores a .env.local

# Opción B: Supabase cloud
# Crear proyecto en supabase.com, luego:
npx supabase link --project-ref <tu-ref>
npx supabase db push
# Copiar anon/service_role keys del dashboard a .env.local

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

Ver [docs/superpowers/specs/](./docs/superpowers/specs/) para la spec del Sprint en curso y [docs/superpowers/plans/](./docs/superpowers/plans/) para los planes de implementación.

## Estado

Sprint 1a — Core Infrastructure (completado en código, pendiente aplicar migraciones contra DB).
