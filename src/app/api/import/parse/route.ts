/**
 * POST /api/import/parse
 *
 * Recibe un archivo (multipart/form-data, campo "file") y devuelve el
 * ImportResult con la lista de clientas extraída por la IA.
 *
 * Auth: requiere membership con rol owner o admin.
 * Tamaño máximo: 4MB (límite de body de Vercel).
 *
 * NO toca DB — solo parsea. La inserción real va via /api/import/commit
 * después de que el user confirme.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireMembership } from '@/lib/auth/require-membership';
import { parseFileWithAI } from '@/lib/integrations/claude/data-importer';

export const runtime = 'nodejs';
export const maxDuration = 60; // permitimos hasta 60s para que Claude procese

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(req: NextRequest) {
  await requireMembership({ minRole: 'admin' });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Body inválido (no es multipart)' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo en el campo "file"' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Archivo demasiado grande (${Math.round(file.size / 1024 / 1024)} MB). Máximo 4 MB.` },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const result = await parseFileWithAI({
      buffer: buf,
      mimeType: file.type,
      filename: file.name,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[import/parse] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
