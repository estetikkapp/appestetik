import { describe, it, expect } from 'vitest';
import { isValidCuit, normalizeCuit } from '@/lib/validators/cuit';

describe('normalizeCuit', () => {
  it('remueve guiones', () => {
    expect(normalizeCuit('20-12345678-6')).toBe('20123456786');
  });

  it('remueve espacios', () => {
    expect(normalizeCuit('20 12345678 6')).toBe('20123456786');
  });

  it('deja intacto un CUIT ya normalizado', () => {
    expect(normalizeCuit('20123456786')).toBe('20123456786');
  });
});

describe('isValidCuit', () => {
  it('acepta CUIT persona masculina válido (20)', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true);
  });

  it('acepta CUIT persona femenina válido (27)', () => {
    expect(isValidCuit('27-12345678-0')).toBe(true);
  });

  it('acepta CUIT empresa válido (30)', () => {
    expect(isValidCuit('30-12345678-1')).toBe(true);
  });

  it('acepta CUIT sin guiones', () => {
    expect(isValidCuit('20123456786')).toBe(true);
  });

  it('rechaza dígito verificador incorrecto', () => {
    expect(isValidCuit('20-12345678-0')).toBe(false);
  });

  it('rechaza menos de 11 dígitos', () => {
    expect(isValidCuit('20-1234567-6')).toBe(false);
  });

  it('rechaza más de 11 dígitos', () => {
    expect(isValidCuit('20-123456789-6')).toBe(false);
  });

  it('rechaza con letras', () => {
    expect(isValidCuit('AB-12345678-6')).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(isValidCuit('')).toBe(false);
  });

  it('rechaza null-like', () => {
    expect(isValidCuit(null as unknown as string)).toBe(false);
    expect(isValidCuit(undefined as unknown as string)).toBe(false);
  });
});
