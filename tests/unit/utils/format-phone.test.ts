import { describe, it, expect } from 'vitest';
import { formatPhoneDisplay } from '@/lib/utils/format-phone';

describe('formatPhoneDisplay', () => {
  it('formatea celular E.164 a display legible', () => {
    expect(formatPhoneDisplay('+5491112345678')).toBe('+54 9 11 1234-5678');
  });

  it('formatea landline E.164 a display', () => {
    expect(formatPhoneDisplay('+541145678900')).toBe('+54 11 4567-8900');
  });

  it('devuelve input si no es formato reconocido', () => {
    expect(formatPhoneDisplay('abc')).toBe('abc');
  });

  it('maneja string vacío', () => {
    expect(formatPhoneDisplay('')).toBe('');
  });
});
