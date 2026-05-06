'use client';

import * as React from 'react';
import { Upload, Check, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseCsv } from '@/lib/utils/csv-parse';
import { importClientsCsv } from '@/actions/clients-import';

const COLUMN_SYNONYMS: Record<string, string[]> = {
  full_name: ['full_name', 'nombre', 'name', 'nombre completo', 'nombres', 'nombre y apellido'],
  phone: ['phone', 'telefono', 'teléfono', 'celular', 'whatsapp', 'whatsapp_phone', 'phone_e164'],
  email: ['email', 'mail', 'correo', 'correo electronico', 'correo electrónico'],
  dni: ['dni', 'documento', 'doc', 'cuil'],
  birthdate: ['birthdate', 'cumple', 'cumpleanos', 'cumpleaños', 'fecha de nacimiento', 'nacimiento'],
  notes: ['notes', 'notas', 'observaciones', 'comentarios'],
};

interface PreviewRow {
  rowIndex: number;
  fullName: string;
  phone: string;
  email: string;
  dni: string;
  birthdate: string;
  notes: string;
  errors: string[];
}

interface PreviewResult {
  rows: PreviewRow[];
  validCount: number;
  invalidCount: number;
  unknownColumns: string[];
}

const PHONE_AR_RE = /^\+?5?4?9?\d{8,12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNI_RE = /^\d{7,11}$/;

function buildPreview(csv: string): { ok: true; preview: PreviewResult } | { ok: false; error: string } {
  const { headers, rows } = parseCsv(csv);
  if (headers.length === 0 || rows.length === 0) {
    return { ok: false, error: 'El archivo no contiene filas válidas.' };
  }

  const colMap: Record<string, number> = {};
  for (const [key, opts] of Object.entries(COLUMN_SYNONYMS)) {
    const idx = headers.findIndex((h) => opts.includes(h));
    if (idx >= 0) colMap[key] = idx;
  }
  if (colMap.full_name === undefined) {
    return {
      ok: false,
      error:
        'No se encontró columna "nombre". Tu archivo debe tener al menos una columna como "nombre", "name" o "full_name".',
    };
  }

  const knownIndices = new Set(Object.values(colMap));
  const unknownColumns = headers.filter((_, idx) => !knownIndices.has(idx));

  const preview: PreviewRow[] = rows.map((r, idx) => {
    const errors: string[] = [];
    const fullName = String(r[colMap.full_name!] ?? '').trim();
    const phone = colMap.phone !== undefined ? String(r[colMap.phone] ?? '').trim() : '';
    const email = colMap.email !== undefined ? String(r[colMap.email] ?? '').trim() : '';
    const dni = colMap.dni !== undefined ? String(r[colMap.dni] ?? '').trim() : '';
    const birthdate = colMap.birthdate !== undefined ? String(r[colMap.birthdate] ?? '').trim() : '';
    const notes = colMap.notes !== undefined ? String(r[colMap.notes] ?? '').trim() : '';

    if (!fullName) errors.push('Nombre vacío');
    if (phone) {
      const cleaned = phone.replace(/[\s\-()+]/g, '');
      if (!PHONE_AR_RE.test('+' + cleaned.replace(/^\+/, ''))) errors.push('Teléfono inválido');
    }
    if (email && !EMAIL_RE.test(email)) errors.push('Email inválido');
    if (dni && !DNI_RE.test(dni.replace(/[\s.\-]/g, ''))) errors.push('DNI inválido');
    if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate) && !/^\d{2}\/\d{2}\/\d{4}$/.test(birthdate)) {
      errors.push('Nacimiento inválido (YYYY-MM-DD o DD/MM/YYYY)');
    }

    return { rowIndex: idx + 2, fullName, phone, email, dni, birthdate, notes, errors };
  });

  return {
    ok: true,
    preview: {
      rows: preview,
      validCount: preview.filter((r) => r.errors.length === 0).length,
      invalidCount: preview.filter((r) => r.errors.length > 0).length,
      unknownColumns,
    },
  };
}

export function ImportClientsClient() {
  const [csv, setCsv] = React.useState('');
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewResult | null>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setParseError('Archivo demasiado grande (máx 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      setCsv(text);
      validateAndPreview(text);
    };
    reader.readAsText(file, 'utf-8');
  }

  function validateAndPreview(text: string) {
    setParseError(null);
    setPreview(null);
    if (!text.trim()) return;
    const result = buildPreview(text);
    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    setPreview(result.preview);
  }

  return (
    <>
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold">Subir archivo</h2>
        <Label htmlFor="csv-file" className="cursor-pointer">
          <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-4 transition-colors hover:border-brand-300">
            <Upload className="h-5 w-5 text-stone-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-700">Elegí un archivo .csv</p>
              <p className="text-xs text-stone-500">Máximo 5MB · UTF-8 recomendado</p>
            </div>
          </div>
        </Label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        <div className="my-4 text-center text-xs text-stone-400">— o pegá el contenido —</div>

        <div className="space-y-1.5">
          <Textarea
            id="csv-text"
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="nombre,telefono,email&#10;María,+5491155551234,maria@example.com"
            className="font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={() => validateAndPreview(csv)} size="sm">
            <FileText className="mr-1 h-3 w-3" />
            Validar
          </Button>
        </div>

        {parseError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </section>

      {preview && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Preview · {preview.rows.length} filas</h2>
              <p className="text-xs text-stone-500">
                <span className="text-emerald-600">{preview.validCount} válidas</span>
                {preview.invalidCount > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="text-red-600">{preview.invalidCount} con errores (se saltarán)</span>
                  </>
                )}
                {preview.unknownColumns.length > 0 && (
                  <>
                    {' '}· columnas ignoradas:{' '}
                    <code className="text-stone-700">{preview.unknownColumns.join(', ')}</code>
                  </>
                )}
              </p>
            </div>

            <form action={importClientsCsv}>
              <input type="hidden" name="csv" value={csv} />
              <SubmitButton pendingText="Importando...">
                <Check className="mr-1 h-3 w-3" />
                Importar {preview.validCount} clientas
              </SubmitButton>
            </form>
          </div>

          <div className="overflow-x-auto rounded-lg border border-stone-100">
            <table className="w-full text-xs">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-2 py-1.5 text-left">Fila</th>
                  <th className="px-2 py-1.5 text-left">Nombre</th>
                  <th className="px-2 py-1.5 text-left">Teléfono</th>
                  <th className="px-2 py-1.5 text-left">Email</th>
                  <th className="px-2 py-1.5 text-left">DNI</th>
                  <th className="px-2 py-1.5 text-left">Cumple</th>
                  <th className="px-2 py-1.5 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((r) => (
                  <tr
                    key={r.rowIndex}
                    className={r.errors.length > 0 ? 'bg-red-50/60' : 'hover:bg-stone-50'}
                  >
                    <td className="px-2 py-1.5 tabular-nums text-stone-400">{r.rowIndex}</td>
                    <td className="px-2 py-1.5">{r.fullName || <em className="text-red-500">—</em>}</td>
                    <td className="px-2 py-1.5 text-stone-600">{r.phone || '—'}</td>
                    <td className="px-2 py-1.5 text-stone-600">{r.email || '—'}</td>
                    <td className="px-2 py-1.5 text-stone-600">{r.dni || '—'}</td>
                    <td className="px-2 py-1.5 text-stone-600">{r.birthdate || '—'}</td>
                    <td className="px-2 py-1.5">
                      {r.errors.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Check className="h-3 w-3" /> ok
                        </span>
                      ) : (
                        <span className="text-red-600">{r.errors.join(', ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 100 && (
              <p className="border-t border-stone-100 bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">
                Mostrando 100 de {preview.rows.length} filas. Las demás se procesarán al confirmar.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
