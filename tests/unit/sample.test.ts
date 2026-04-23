import { describe, it, expect } from 'vitest';

describe('Vitest setup', () => {
  it('suma básica', () => {
    expect(1 + 1).toBe(2);
  });

  it('matchers de jest-dom disponibles', () => {
    const el = document.createElement('div');
    el.textContent = 'hola';
    expect(el).toHaveTextContent('hola');
  });
});
