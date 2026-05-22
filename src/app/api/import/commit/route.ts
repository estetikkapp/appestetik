/**
 * POST /api/import/commit
 *
 * Recibe la lista final de clientas (ya editada por el user) y la inserta
 * en la DB. Usa admin client porque inserta en lote.
 *
 * Body JSON:
 *   {
 *     clients: [
 *       { full_name, phone_e164, email, dni, birthdate, notes },
 *       ...
 *     ]
 *   }
 *
 * Devuelve:
 *   {
 *     inserted: number,
 *     skipped: { name, reason }[],
 *     duplicates_merged: number
 *   }
 *
 * Comportamiento:
 *   - Skip silencioso si full_name está vacío
 *   - Detecta duplicados por phone_e164 dentro del mismo batch + contra DB
 *     (devuelve duplicates_merged)
 *   - Inserta el resto con admin client
 *   - Audit log con el total importado
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

interface CommitClient {
  full_name?: string;
  phone_e164?: string | null;
  email?: string | null;
  dni?: string | null;
  birthdate?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  const { orgId, userId } = await requireMembership({ minRole: 'admin' });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const incoming: CommitClient[] = Array.isArray(body?.clients) ? body.clients : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: 'Sin clientas para importar' }, { status: 400 });
  }
  if (incoming.length > 5000) {
    return NextResponse.json({ error: 'Demasiadas filas (máximo 5000 por importación)' }, { status: 413 });
  }

  const admin = createAdminClient();

  // 1) Skip filas sin nombre
  const skipped: Array<{ name: string; reason: string }> = [];
  const candidates: CommitClient[] = [];
  for (const c of incoming) {
    const name = c.full_name?.trim();
    if (!name) {
      skipped.push({ name: '(vacío)', reason: 'sin nombre' });
      continue;
    }
    candidates.push({ ...c, full_name: name });
  }

  // 2) Dedup interna por teléfono (mismo batch)
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  let internalDupes = 0;
  const dedupedBatch: CommitClient[] = [];
  for (const c of candidates) {
    if (c.phone_e164 && seenPhones.has(c.phone_e164)) {
      internalDupes++;
      continue;
    }
    if (c.email && seenEmails.has(c.email)) {
      internalDupes++;
      continue;
    }
    if (c.phone_e164) seenPhones.add(c.phone_e164);
    if (c.email) seenEmails.add(c.email);
    dedupedBatch.push(c);
  }

  // 3) Detectar duplicados contra DB existente (matchea por phone o email)
  const phonesToCheck = dedupedBatch.map((c) => c.phone_e164).filter((p): p is string => !!p);
  const emailsToCheck = dedupedBatch.map((c) => c.email).filter((e): e is string => !!e);

  let existingPhones = new Set<string>();
  let existingEmails = new Set<string>();
  if (phonesToCheck.length > 0) {
    const { data } = await admin
      .from('clients')
      .select('phone_e164')
      .eq('organization_id', orgId)
      .in('phone_e164', phonesToCheck);
    existingPhones = new Set((data ?? []).map((r) => r.phone_e164).filter((p): p is string => !!p));
  }
  if (emailsToCheck.length > 0) {
    const { data } = await admin
      .from('clients')
      .select('email')
      .eq('organization_id', orgId)
      .in('email', emailsToCheck);
    existingEmails = new Set((data ?? []).map((r) => r.email).filter((e): e is string => !!e));
  }

  let dbDupes = 0;
  const toInsert = dedupedBatch.filter((c) => {
    if (c.phone_e164 && existingPhones.has(c.phone_e164)) {
      dbDupes++;
      return false;
    }
    if (c.email && existingEmails.has(c.email)) {
      dbDupes++;
      return false;
    }
    return true;
  });

  // 4) Insert en lote
  let inserted = 0;
  if (toInsert.length > 0) {
    const rows = toInsert.map((c) => ({
      organization_id: orgId,
      full_name: c.full_name!,
      phone_e164: c.phone_e164 ?? null,
      email: c.email ?? null,
      dni: c.dni ?? null,
      birthdate: c.birthdate ?? null,
      notes: c.notes ?? null,
    }));

    const { error: insErr } = await admin.from('clients').insert(rows);
    if (insErr) {
      console.error('[import/commit] insert error:', insErr);
      return NextResponse.json(
        { error: `No se pudieron insertar las clientas: ${insErr.message}` },
        { status: 500 }
      );
    }
    inserted = rows.length;
  }

  await audit({
    organizationId: orgId,
    action: 'import.clients',
    entityType: 'organization',
    entityId: orgId,
    payload: {
      attempted: incoming.length,
      inserted,
      duplicates_merged: internalDupes + dbDupes,
      skipped_no_name: skipped.length,
      triggered_by_user_id: userId,
    },
  });

  return NextResponse.json({
    inserted,
    skipped,
    duplicates_merged: internalDupes + dbDupes,
  });
}
