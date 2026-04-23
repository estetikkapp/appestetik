import { describe, it, expect } from 'vitest';
import { normalizePhoneAr, isValidPhoneAr } from '@/lib/validators/phone-ar';

describe('normalizePhoneAr', () => {
  it('preserva celular ya normalizado (+549...)', () => {
    expect(normalizePhoneAr('+5491112345678')).toBe('+5491112345678');
  });

  it('remueve espacios y guiones', () => {
    expect(normalizePhoneAr('+54 9 11 1234-5678')).toBe('+5491112345678');
  });

  it('agrega +54 a input de 11 dígitos que empieza con 9', () => {
    expect(normalizePhoneAr('91112345678')).toBe('+5491112345678');
  });

  it('acepta landline +54 + 10 dígitos', () => {
    expect(normalizePhoneAr('+541145678900')).toBe('+541145678900');
  });

  it('devuelve string vacío para input vacío', () => {
    expect(normalizePhoneAr('')).toBe('');
  });
});

describe('isValidPhoneAr', () => {
  it('acepta celular +549 + 10 dígitos', () => {
    expect(isValidPhoneAr('+5491112345678')).toBe(true);
  });

  it('acepta landline +54 + 10 dígitos (sin 9)', () => {
    expect(isValidPhoneAr('+541145678900')).toBe(true);
  });

  it('acepta celular sin formato pero normalizable', () => {
    expect(isValidPhoneAr('+54 9 11 1234 5678')).toBe(true);
  });

  it('rechaza string vacío', () => {
    expect(isValidPhoneAr('')).toBe(false);
  });

  it('rechaza país no argentino', () => {
    expect(isValidPhoneAr('+15551234567')).toBe(false);
  });

  it('rechaza demasiado corto', () => {
    expect(isValidPhoneAr('+549123')).toBe(false);
  });

  it('rechaza demasiado largo', () => {
    expect(isValidPhoneAr('+54911123456789012')).toBe(false);
  });
});
