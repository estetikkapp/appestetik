import { describe, it, expect } from 'vitest';
import { isValidDni, normalizeDni } from '@/lib/validators/dni';

describe('normalizeDni', () => {
  it('remueve puntos', () => {
    expect(normalizeDni('12.345.678')).toBe('12345678');
  });

  it('remueve espacios', () => {
    expect(normalizeDni('12 345 678')).toBe('12345678');
  });
});

describe('isValidDni', () => {
  it('acepta DNI de 8 dígitos', () => {
    expect(isValidDni('12345678')).toBe(true);
  });

  it('acepta DNI de 7 dígitos', () => {
    expect(isValidDni('1234567')).toBe(true);
  });

  it('acepta DNI con puntos', () => {
    expect(isValidDni('12.345.678')).toBe(true);
  });

  it('rechaza con letras', () => {
    expect(isValidDni('ABC12345')).toBe(false);
  });

  it('rechaza menos de 7 dígitos', () => {
    expect(isValidDni('123456')).toBe(false);
  });

  it('rechaza más de 8 dígitos', () => {
    expect(isValidDni('123456789')).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(isValidDni('')).toBe(false);
  });

  it('rechaza null/undefined', () => {
    expect(isValidDni(null as unknown as string)).toBe(false);
    expect(isValidDni(undefined as unknown as string)).toBe(false);
  });
});
