import { describe, it, expect } from 'vitest';
import { formatArs, parseArs } from '@/lib/utils/format-ars';

describe('formatArs', () => {
  it('formatea miles con punto', () => {
    expect(formatArs(15990)).toBe('$15.990');
  });

  it('formatea millones', () => {
    expect(formatArs(1000000)).toBe('$1.000.000');
  });

  it('maneja cero', () => {
    expect(formatArs(0)).toBe('$0');
  });

  it('no muestra decimales si son cero', () => {
    expect(formatArs(1000.00)).toBe('$1.000');
  });

  it('muestra decimales si existen', () => {
    expect(formatArs(1000.5)).toBe('$1.000,50');
    expect(formatArs(1000.55)).toBe('$1.000,55');
  });

  it('maneja negativos', () => {
    expect(formatArs(-500)).toBe('-$500');
  });
});

describe('parseArs', () => {
  it('parsea string formateado de vuelta a número', () => {
    expect(parseArs('$15.990')).toBe(15990);
    expect(parseArs('$1.000.000')).toBe(1000000);
    expect(parseArs('$1.000,50')).toBe(1000.5);
  });

  it('parsea sin símbolo', () => {
    expect(parseArs('15.990')).toBe(15990);
  });

  it('retorna NaN para input inválido', () => {
    expect(parseArs('abc')).toBeNaN();
  });
});
