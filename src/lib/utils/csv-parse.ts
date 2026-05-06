/**
 * Parser CSV minimal RFC-4180-ish, server- y client-safe (sólo APIs de JS std).
 *
 * - Soporta separador `,` o `;` (autodetecta cuál es más frecuente en el header)
 * - Soporta celdas entrecomilladas con `"…"`, escapando `""`
 * - Quita BOM UTF-8 inicial
 * - Tolera CRLF y LF
 * - Filtra filas totalmente vacías
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === sep) {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const filtered = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (filtered.length === 0) return { headers: [], rows: [] };
  const headers = (filtered[0] ?? []).map((h) => h.trim().toLowerCase());
  return { headers, rows: filtered.slice(1) };
}
