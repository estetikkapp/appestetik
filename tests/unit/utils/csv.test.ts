import { describe, it, expect } from 'vitest';
import { rowsToCsv, csvFilename } from '@/lib/utils/csv';

describe('rowsToCsv', () => {
  it('produces a header + data row', () => {
    const csv = rowsToCsv(['name', 'age'], [['Alice', 30]]);
    expect(csv).toContain('name,age');
    expect(csv).toContain('Alice,30');
  });

  it('starts with UTF-8 BOM', () => {
    const csv = rowsToCsv(['x'], [['y']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF row separator', () => {
    const csv = rowsToCsv(['a'], [['1'], ['2']]);
    expect(csv).toContain('\r\n');
  });

  it('quotes cells with commas', () => {
    const csv = rowsToCsv(['x'], [['a, b']]);
    expect(csv).toContain('"a, b"');
  });

  it('quotes cells with newlines', () => {
    const csv = rowsToCsv(['x'], [['line1\nline2']]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('escapes embedded quotes by doubling', () => {
    const csv = rowsToCsv(['x'], [['She said "hi"']]);
    expect(csv).toContain('"She said ""hi"""');
  });

  it('renders null/undefined as empty cell', () => {
    const csv = rowsToCsv(['a', 'b'], [[null, undefined]]);
    expect(csv).toContain(',');
  });

  it('serializes Dates as ISO', () => {
    const d = new Date('2025-01-15T10:30:00Z');
    const csv = rowsToCsv(['ts'], [[d]]);
    expect(csv).toContain('2025-01-15T10:30:00.000Z');
  });
});

describe('csvFilename', () => {
  it('appends YYYYMMDD to prefix and ends with .csv', () => {
    const name = csvFilename('turnos');
    expect(name).toMatch(/^turnos_\d{8}\.csv$/);
  });
});
