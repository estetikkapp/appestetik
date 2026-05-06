'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseCsv } from '@/lib/utils/csv-parse';
import { isValidPhoneAr, normalizePhoneAr } from '@/lib/validators/phone-ar';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';
import { isValidDni, normalizeDni } from '@/lib/validators/dni';
import { audit } from '@/lib/audit';

const COLUMN_SYNONYMS: Record<string, string[]> = {
  full_name: ['full_name', 'nombre', 'name', 'nombre completo', 'nombres', 'nombre y apellido'],
  phone: ['phone', 'telefono', 'teléfono', 'celular', 'whatsapp', 'whatsapp_phone', 'phone_e164'],
  email: ['email', 'mail', 'correo', 'correo electronico', 'correo electrónico'],
  dni: ['dni', 'documento', 'doc', 'cuil'],
  birthdate: ['birthdate', 'cumple', 'cumpleanos', 'cumpleaños', 'fecha de nacimiento', 'nacimiento'],
  notes: ['notes', 'notas', 'observaciones', 'comentarios'],
};

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [key, opts] of Object.entries(COLUMN_SYNONYMS)) {
    const idx = headers.findIndex((h) => opts.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

interface ParsedRow {
  fullName: string;
  phone: string | null;
  email: string | null;
  dni: string | null;
  birthdate: string | null;
  notes: string | null;
  errors: string[];
}

function validateAndNormalizeRow(r: string[], colMap: Record<string, number>): ParsedRow {
  const errors: string[] = [];

  const fullName = String(r[colMap.full_name!] ?? '').trim();
  const rawPhone = colMap.phone !== undefined ? String(r[colMap.phone] ?? '').trim() : '';
  const rawEmail = colMap.email !== undefined ? String(r[colMap.email] ?? '').trim() : '';
  const rawDni = colMap.dni !== undefined ? String(r[colMap.dni] ?? '').trim() : '';
  const rawBirthdate =
    colMap.birthdate !== undefined ? String(r[colMap.birthdate] ?? '').trim() : '';
  const notes = colMap.notes !== undefined ? String(r[colMap.notes] ?? '').trim() : '';

  if (!fullName) errors.push('Nombre vacío');

  let phone: string | null = null;
  if (rawPhone) {
    if (!isValidPhoneAr(rawPhone)) errors.push('Teléfono inválido');
    else phone = normalizePhoneAr(rawPhone);
  }

  let email: string | null = null;
  if (rawEmail) {
    if (!isValidEmail(rawEmail)) errors.push('Email inválido');
    else email = normalizeEmail(rawEmail);
  }

  let dni: string | null = null;
  if (rawDni) {
    if (!isValidDni(rawDni)) errors.push('DNI inválido');
    else dni = normalizeDni(rawDni);
  }

  let birthdate: string | null = null;
  if (rawBirthdate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawBirthdate)) {
      birthdate = rawBirthdate;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawBirthdate)) {
      const [d, m, y] = rawBirthdate.split('/');
      birthdate = `${y}-${m}-${d}`;
    } else {
      errors.push('Nacimiento inválido (use YYYY-MM-DD o DD/MM/YYYY)');
    }
  }

  return { fullName, phone, email, dni, birthdate, notes: notes || null, errors };
}

/**
 * Server Action de importación. Recibe el CSV pegado o subido como string en
 * el campo `csv`. Parsea, valida, deduplica por phone (vs base existente) y
 * inserta los válidos. Devuelve el redirect con el conteo final.
 */
export async function importClientsCsv(formData: FormData): Promise<void> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');

  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) redirect('/clientas/importar?error=Subi+un+archivo+o+pega+el+contenido+CSV');

  const { headers, rows } = parseCsv(csv);
  if (headers.length === 0 || rows.length === 0) {
    redirect('/clientas/importar?error=El+archivo+no+tiene+filas+v%C3%A1lidas');
  }

  const colMap = buildColumnMap(headers);
  if (colMap.full_name === undefined) {
    redirect(
      '/clientas/importar?error=No+se+encontr%C3%B3+columna+nombre.+Pon%C3%A9+un+header+como+%22nombre%22+o+%22full_name%22'
    );
  }

  const parsed = rows.map((r) => validateAndNormalizeRow(r, colMap));

  // Deduplicar contra base existente por phone
  const supabase = createClient();
  const phones = parsed.map((p) => p.phone).filter((p): p is string => !!p);
  if (phones.length > 0) {
    const { data: existing } = await supabase
      .from('clients')
      .select('phone_e164')
      .eq('organization_id', orgId)
      .in('phone_e164', phones);
    const existingSet = new Set((existing ?? []).map((e) => e.phone_e164));
    for (const row of parsed) {
      if (row.phone && existingSet.has(row.phone)) {
        row.errors.push('Ya existe en la base con ese teléfono');
      }
    }
  }

  const validRows = parsed.filter((r) => r.errors.length === 0);
  const totalParsed = parsed.length;
  const validCount = validRows.length;
  const invalidCount = totalParsed - validCount;

  if (validCount === 0) {
    redirect(
      `/clientas/importar?error=Ninguna+fila+v%C3%A1lida.+Total+leidas+${totalParsed}+con+${invalidCount}+errores`
    );
  }

  const inserts = validRows.map((r) => ({
    organization_id: orgId,
    full_name: r.fullName,
    phone_e164: r.phone,
    email: r.email,
    dni: r.dni,
    birthdate: r.birthdate,
    notes: r.notes,
  }));

  let inserted = 0;
  for (let i = 0; i < inserts.length; i += 100) {
    const batch = inserts.slice(i, i + 100);
    const { error, count } = await supabase
      .from('clients')
      .insert(batch, { count: 'exact' });
    if (error) {
      if (inserted === 0) {
        redirect(`/clientas/importar?error=${encodeURIComponent(error.message)}`);
      }
      break;
    }
    inserted += count ?? batch.length;
  }

  await audit({
    organizationId: orgId,
    action: 'client.bulk_import',
    entityType: 'client',
    payload: {
      total_parsed: totalParsed,
      valid: validCount,
      invalid: invalidCount,
      inserted,
    },
  });

  revalidatePath('/clientas');
  redirect(
    `/clientas?ok=importadas&n=${inserted}${invalidCount > 0 ? `&skipped=${invalidCount}` : ''}`
  );
}
