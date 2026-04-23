import { describe, it, expect } from 'vitest';
import { isValidSlug, RESERVED_SLUGS } from '@/lib/validators/slug';

describe('isValidSlug', () => {
  it('acepta slug válido simple', () => {
    expect(isValidSlug('centro-belleza')).toBe(true);
  });

  it('acepta slug con números', () => {
    expect(isValidSlug('estetica123')).toBe(true);
  });

  it('acepta slug de 3 caracteres (mínimo)', () => {
    expect(isValidSlug('abc')).toBe(true);
  });

  it('rechaza slug de 2 caracteres', () => {
    expect(isValidSlug('ab')).toBe(false);
  });

  it('rechaza slug de más de 40 caracteres', () => {
    expect(isValidSlug('a'.repeat(41))).toBe(false);
  });

  it('rechaza mayúsculas', () => {
    expect(isValidSlug('Centro-Belleza')).toBe(false);
  });

  it('rechaza caracteres especiales', () => {
    expect(isValidSlug('centro_belleza')).toBe(false);
    expect(isValidSlug('centro.belleza')).toBe(false);
    expect(isValidSlug('centro belleza')).toBe(false);
  });

  it('rechaza empezar con guión', () => {
    expect(isValidSlug('-centro')).toBe(false);
  });

  it('rechaza terminar con guión', () => {
    expect(isValidSlug('centro-')).toBe(false);
  });

  it('rechaza palabras reservadas', () => {
    expect(isValidSlug('admin')).toBe(false);
    expect(isValidSlug('api')).toBe(false);
    expect(isValidSlug('panel')).toBe(false);
    expect(isValidSlug('auth')).toBe(false);
    expect(isValidSlug('login')).toBe(false);
  });

  it('rechaza string vacío', () => {
    expect(isValidSlug('')).toBe(false);
  });
});

describe('RESERVED_SLUGS', () => {
  it('incluye palabras críticas', () => {
    expect(RESERVED_SLUGS).toContain('admin');
    expect(RESERVED_SLUGS).toContain('api');
    expect(RESERVED_SLUGS).toContain('c');
    expect(RESERVED_SLUGS).toContain('www');
  });
});
