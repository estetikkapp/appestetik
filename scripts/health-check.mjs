#!/usr/bin/env node
/**
 * Health check de appestetika — recorre toda la app y reporta dónde hay
 * errores. No modifica nada (read-only). Sirve para verificar después de
 * un deploy o cuando algo se siente raro.
 *
 * Uso:
 *   npm run health                          (chequea prod = estetikkapp.com)
 *   BASE_URL=http://localhost:3000 npm run health   (chequea local)
 *
 * Necesita:
 *   - .env.local con SUPABASE_SERVICE_ROLE_KEY (para chequear DB)
 *   - Opcional: MP_APPESTETIKA_ACCESS_TOKEN (para chequear MP)
 *
 * Exit code:
 *   0 = todo OK
 *   1 = al menos 1 check falló
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL ?? 'https://estetikkapp.com';
const SUPABASE_PROJECT_REF = 'wlvlhiosyzyeqhyabcnx';

// Cargar .env.local si existe (no usamos dotenv para evitar dependencia)
loadDotenv(resolve(process.cwd(), '.env.local'));

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

let pass = 0;
let fail = 0;
let warn = 0;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function header(title) {
  console.log(`\n${COLORS.bold}${COLORS.blue}━━ ${title} ━━${COLORS.reset}`);
}

function ok(label, detail = '') {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${label}${detail ? COLORS.gray + ' — ' + detail + COLORS.reset : ''}`);
  pass++;
}

function bad(label, error) {
  console.log(`  ${COLORS.red}✗${COLORS.reset} ${COLORS.bold}${label}${COLORS.reset}`);
  if (error) console.log(`    ${COLORS.red}↳ ${error}${COLORS.reset}`);
  fail++;
}

function warning(label, detail = '') {
  console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ${label}${detail ? COLORS.gray + ' — ' + detail + COLORS.reset : ''}`);
  warn++;
}

async function http(method, url, opts = {}) {
  const res = await fetch(url, {
    method,
    redirect: opts.redirect ?? 'manual',
    headers: opts.headers ?? {},
    body: opts.body,
    signal: AbortSignal.timeout(15000),
  });
  return res;
}

function loadDotenv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      // quitar comillas si las hay
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
}

async function supabaseQuery(sql) {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!token) throw new Error('SUPABASE_MANAGEMENT_TOKEN no seteada (necesaria para chequear schema)');
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'appestetika-health-check',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) throw new Error(`Supabase API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Checks
// ────────────────────────────────────────────────────────────────────────────

async function checkEnvVars() {
  header('Variables de entorno');

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
  ];
  for (const key of required) {
    if (process.env[key]) ok(key);
    else bad(key, 'no seteada');
  }

  // Opcionales pero importantes
  const optional = [
    { key: 'MP_APPESTETIKA_ACCESS_TOKEN', warn: 'sin esto los cobros no funcionan' },
    { key: 'MP_APPESTETIKA_WEBHOOK_SECRET', warn: 'webhook no valida firma — modo basic' },
    { key: 'CRON_SECRET', warn: 'crons sin protección' },
    { key: 'RESEND_API_KEY', warn: 'no se mandan emails' },
    { key: 'ANTHROPIC_API_KEY', warn: 'IA deshabilitada (skin analysis + protocols)' },
    { key: 'SUPABASE_MANAGEMENT_TOKEN', warn: 'no se puede chequear el schema (skip DB checks)' },
  ];
  for (const { key, warn: w } of optional) {
    if (process.env[key]) ok(key);
    else warning(key, w);
  }
}

async function checkPublicPages() {
  header(`Páginas públicas en ${BASE_URL}`);

  const pages = [
    { path: '/precios', allowed: [200] },
    { path: '/agente', allowed: [200] },
    { path: '/auth/login', allowed: [200] },
    { path: '/auth/signup', allowed: [200] },
    { path: '/', allowed: [200, 307, 302] }, // redirect a login si no hay sesión
  ];
  for (const p of pages) {
    try {
      const res = await http('GET', `${BASE_URL}${p.path}`, { redirect: 'manual' });
      if (p.allowed.includes(res.status)) {
        ok(`GET ${p.path}`, `HTTP ${res.status}`);
      } else {
        bad(`GET ${p.path}`, `HTTP ${res.status} (esperaba ${p.allowed.join('/')})`);
      }
    } catch (err) {
      bad(`GET ${p.path}`, err.message);
    }
  }
}

async function checkApiEndpoints() {
  header(`API endpoints en ${BASE_URL}`);

  const endpoints = [
    // Públicos: deberían retornar 200 o 400 (sin params)
    { method: 'GET', path: '/api/slots', allowed: [400], desc: 'rechaza sin params' },
    // Protegidos: redirige a login (307/302) o 401
    { method: 'GET', path: '/api/subscriptions/me', allowed: [307, 302, 401], desc: 'requiere auth' },
    // Webhook: acepta POST con body vacío (lo skipea)
    { method: 'POST', path: '/api/webhooks/mp-saas', allowed: [200, 400], desc: 'POST sin firma', body: '{}' },
    // Cron: sin auth → 401
    { method: 'GET', path: '/api/cron/process-plan-changes', allowed: [401], desc: 'rechaza sin CRON_SECRET' },
    { method: 'GET', path: '/api/cron/reminders', allowed: [401], desc: 'rechaza sin CRON_SECRET' },
  ];

  for (const e of endpoints) {
    try {
      const res = await http(e.method, `${BASE_URL}${e.path}`, {
        redirect: 'manual',
        headers: e.body ? { 'Content-Type': 'application/json' } : {},
        body: e.body,
      });
      if (e.allowed.includes(res.status)) {
        ok(`${e.method} ${e.path}`, `HTTP ${res.status} (${e.desc})`);
      } else {
        bad(`${e.method} ${e.path}`, `HTTP ${res.status} — ${e.desc}`);
      }
    } catch (err) {
      bad(`${e.method} ${e.path}`, err.message);
    }
  }
}

async function checkDatabaseSchema() {
  header('Schema de Base de Datos (Supabase)');

  if (!process.env.SUPABASE_MANAGEMENT_TOKEN) {
    warning('SKIP', 'sin SUPABASE_MANAGEMENT_TOKEN (sbp_...) no se puede chequear schema');
    return;
  }

  const expectedTables = [
    // Core
    'organizations',
    'memberships',
    'invitations',
    'clients',
    'services',
    'appointments',
    'schedule_templates',
    'schedule_blocks',
    'business_hours',
    'resources',
    // Plans (capa 1)
    'plan_subscriptions',
    'ai_usage_counters',
    'ai_addon_purchases',
    'saas_invoices',
    'plan_change_events',
    // Bridge
    'bridge_tokens',
    'bridge_state',
    'bridge_commands',
    // Otros
    'payments',
    'invoices',
    'audit_log',
    'skin_analyses',
    'treatment_protocols',
  ];

  try {
    const rows = await supabaseQuery(
      `select table_name from information_schema.tables where table_schema='public'`
    );
    const present = new Set(rows.map((r) => r.table_name));
    for (const t of expectedTables) {
      if (present.has(t)) ok(`tabla ${t}`);
      else bad(`tabla ${t}`, 'no existe en DB');
    }

    // Chequear que las columnas viejas YA NO existan
    const oldCols = await supabaseQuery(
      `select column_name from information_schema.columns where table_schema='public' and table_name='organizations' and column_name in ('subscription_tier','trial_ends_at')`
    );
    if (oldCols.length === 0) ok('organizations.subscription_tier y .trial_ends_at removidas');
    else bad('Columnas legacy aún presentes', oldCols.map((c) => c.column_name).join(', '));

    // Chequear que legacy_grandfathered exista
    const grandCol = await supabaseQuery(
      `select 1 as x from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='legacy_grandfathered'`
    );
    if (grandCol.length > 0) ok('organizations.legacy_grandfathered presente');
    else bad('organizations.legacy_grandfathered', 'no existe');

    // Chequear que appointments.created_by exista
    const createdByCol = await supabaseQuery(
      `select 1 as x from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='created_by'`
    );
    if (createdByCol.length > 0) ok('appointments.created_by presente (audit trail)');
    else bad('appointments.created_by', 'no existe');
  } catch (err) {
    bad('chequeo de schema', err.message);
  }
}

async function checkSupabaseConnectivity() {
  header('Conectividad Supabase');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    bad('Supabase', 'faltan env vars');
    return;
  }

  // Endpoint que sí acepta consultas con anon: /auth/v1/health (no requiere
  // auth, devuelve 200 si Supabase Auth está vivo). Mejor proxy de "DB
  // alive" que /rest/v1/ que devuelve 401 sin un table específico.
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) ok('Supabase Auth /health responde', `HTTP ${res.status}`);
    else bad('Supabase Auth /health', `HTTP ${res.status}`);
  } catch (err) {
    bad('Supabase Auth /health', err.message);
  }
}

async function checkMercadoPago() {
  header('Mercado Pago (cuenta SaaS appestetika)');

  const token = process.env.MP_APPESTETIKA_ACCESS_TOKEN;
  if (!token) {
    warning('SKIP', 'MP_APPESTETIKA_ACCESS_TOKEN no seteada');
    return;
  }

  try {
    const res = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const me = await res.json();
      ok('MP token válido', `user ID ${me.id} (${me.nickname ?? me.email ?? 'sin nick'})`);
    } else {
      bad('MP token rechazado', `HTTP ${res.status}`);
    }
  } catch (err) {
    bad('MP /users/me', err.message);
  }
}

async function checkAgentRelease() {
  header('Release del agente local (GitHub)');

  const url = 'https://github.com/estetikkapp/appestetik/releases/latest/download/appestetika-bridge-setup.exe';
  try {
    const res = await http('HEAD', url, { redirect: 'follow' });
    if (res.ok) {
      const size = res.headers.get('content-length');
      ok(
        'appestetika-bridge-setup.exe descargable',
        size ? `${Math.round(Number(size) / 1024 / 1024)} MB` : 'tamaño desconocido'
      );
    } else {
      bad('agent .exe', `HTTP ${res.status}`);
    }
  } catch (err) {
    bad('agent .exe', err.message);
  }
}

async function checkActiveSubscriptionsExist() {
  header('Sanidad de planes en DB');

  if (!process.env.SUPABASE_MANAGEMENT_TOKEN) {
    warning('SKIP', 'sin SUPABASE_MANAGEMENT_TOKEN');
    return;
  }

  try {
    // Cada org viva debería tener exactamente 1 sub en estados activos
    const orphans = await supabaseQuery(
      `select count(*)::int as c from public.organizations o
       where not exists (
         select 1 from public.plan_subscriptions ps
         where ps.organization_id = o.id
           and ps.status in ('trialing', 'active', 'past_due', 'suspended', 'trial_expired')
       )`
    );
    const orphanCount = orphans[0]?.c ?? 0;
    if (orphanCount === 0) ok('todas las orgs tienen sub viva');
    else warning('orgs sin sub viva', `${orphanCount} orgs (capa 4 va a forzar plan picker)`);

    // No debería haber DOS subs vivas en la misma org
    const dupes = await supabaseQuery(
      `select count(*)::int as c from (
         select organization_id from public.plan_subscriptions
         where status in ('trialing', 'active', 'past_due', 'suspended', 'trial_expired')
         group by organization_id
         having count(*) > 1
       ) x`
    );
    const dupeCount = dupes[0]?.c ?? 0;
    if (dupeCount === 0) ok('no hay orgs con múltiples subs vivas (unique constraint OK)');
    else bad('orgs con múltiples subs vivas', `${dupeCount} orgs — investigar`);

    // saas_invoices pending hace +24h sin retry programado = posible problema
    const stuck = await supabaseQuery(
      `select count(*)::int as c from public.saas_invoices
       where status='pending'
         and created_at < now() - interval '24 hours'
         and next_retry_at is null`
    );
    const stuckCount = stuck[0]?.c ?? 0;
    if (stuckCount === 0) ok('no hay saas_invoices pending atascadas (+24h)');
    else warning('saas_invoices pending atascadas', `${stuckCount} facturas sin pago hace +24h`);
  } catch (err) {
    bad('sanidad de planes', err.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`${COLORS.bold}🩺 Health check de appestetika${COLORS.reset}`);
  console.log(`${COLORS.gray}Target: ${BASE_URL}${COLORS.reset}`);

  await checkEnvVars();
  await checkSupabaseConnectivity();
  await checkMercadoPago();
  await checkPublicPages();
  await checkApiEndpoints();
  await checkAgentRelease();
  await checkDatabaseSchema();
  await checkActiveSubscriptionsExist();

  console.log(
    `\n${COLORS.bold}Resumen:${COLORS.reset} ` +
      `${COLORS.green}${pass} OK${COLORS.reset}, ` +
      `${COLORS.red}${fail} fallaron${COLORS.reset}, ` +
      `${COLORS.yellow}${warn} warnings${COLORS.reset}`
  );

  if (fail > 0) {
    console.log(`\n${COLORS.red}❌ Hay ${fail} cosa(s) rota(s). Revisalas arriba.${COLORS.reset}`);
    process.exit(1);
  } else if (warn > 0) {
    console.log(`\n${COLORS.yellow}⚠️  Pasó pero con warnings — revisar si te importan.${COLORS.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${COLORS.green}✅ Todo OK.${COLORS.reset}`);
    process.exit(0);
  }
})().catch((err) => {
  console.error(`${COLORS.red}Error fatal: ${err.message}${COLORS.reset}`);
  process.exit(2);
});
