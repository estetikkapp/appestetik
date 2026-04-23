import { describe, it, expect } from 'vitest';
import { formatDateAr, formatDateTimeAr, AR_TIMEZONE } from '@/lib/utils/dates';

describe('AR_TIMEZONE', () => {
  it('es America/Argentina/Buenos_Aires', () => {
    expect(AR_TIMEZONE).toBe('America/Argentina/Buenos_Aires');
  });
});

describe('formatDateAr', () => {
  it('formatea fecha a DD/MM/YYYY', () => {
    const date = new Date('2026-04-23T15:30:00Z');
    expect(formatDateAr(date)).toBe('23/04/2026');
  });

  it('acepta string ISO', () => {
    expect(formatDateAr('2026-12-31T10:00:00Z')).toBe('31/12/2026');
  });

  it('retorna string vacío para input inválido', () => {
    expect(formatDateAr('')).toBe('');
    expect(formatDateAr('not-a-date')).toBe('');
  });
});

describe('formatDateTimeAr', () => {
  it('formatea a DD/MM/YYYY HH:mm', () => {
    const date = new Date('2026-04-23T15:30:00-03:00'); // 15:30 AR
    expect(formatDateTimeAr(date)).toBe('23/04/2026 15:30');
  });
});
