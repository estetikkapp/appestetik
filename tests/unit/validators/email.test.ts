import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail } from '@/lib/validators/email';

describe('normalizeEmail', () => {
  it('lowercase y trim', () => {
    expect(normalizeEmail('  JUAN@Example.COM  ')).toBe('juan@example.com');
  });
});

describe('isValidEmail', () => {
  it('acepta email válido', () => {
    expect(isValidEmail('test@test.com')).toBe(true);
  });

  it('acepta con subdomain', () => {
    expect(isValidEmail('user@mail.example.com.ar')).toBe(true);
  });

  it('rechaza sin @', () => {
    expect(isValidEmail('test.com')).toBe(false);
  });

  it('rechaza sin dominio', () => {
    expect(isValidEmail('test@')).toBe(false);
  });

  it('rechaza vacío', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
