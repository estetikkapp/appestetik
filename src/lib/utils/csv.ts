/**
 * Utilidades para serializar datos a CSV (RFC 4180).
 *
 * - Encerra cualquier celda con `,`, `"`, salto de línea o ; entre comillas dobles
 * - Escapa `"` interno doblándolo (`""`)
 * - Usa `\r\n` como separador de filas (Excel-friendly)
 * - Prefija con BOM UTF-8 para que Excel detecte acentos correctamente
 */

const NEEDS_QUOTING_RE = /[",\r\n;]/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value);
  } else {
    str = String(value);
  }
  if (NEEDS_QUOTING_RE.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: Array<unknown[]>): string {
  const BOM = '﻿';
  const lines: string[] = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return BOM + lines.join('\r\n');
}

export function csvFilename(prefix: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${prefix}_${yyyy}${mm}${dd}.csv`;
}
