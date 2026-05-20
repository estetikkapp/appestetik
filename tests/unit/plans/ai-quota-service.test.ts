import { describe, it, expect } from 'vitest';
import { computeQuotaStatus } from '@/lib/plans/ai-quota-service';

// Solo testeamos la función pura. Las funciones que tocan DB requieren
// integration tests con una DB de test — fuera del scope de capa 2.

const makeCounter = (overrides: Partial<{
  skin_diagnosis_used: number;
  protocol_generator_used: number;
  skin_diagnosis_bonus_quota: number;
  protocol_generator_bonus_quota: number;
}> = {}) => ({
  skin_diagnosis_used: 0,
  protocol_generator_used: 0,
  skin_diagnosis_bonus_quota: 0,
  protocol_generator_bonus_quota: 0,
  ...overrides,
});

describe('ai-quota / computeQuotaStatus — Gabinete', () => {
  it('counter en 0 → 20 disponibles para skin_diagnosis', () => {
    const status = computeQuotaStatus('gabinete', makeCounter(), 'skin_diagnosis');
    expect(status.plan_limit).toBe(20);
    expect(status.bonus).toBe(0);
    expect(status.used).toBe(0);
    expect(status.total_available).toBe(20);
    expect(status.remaining).toBe(20);
    expect(status.exhausted).toBe(false);
  });

  it('counter en 0 → 10 disponibles para protocol', () => {
    const status = computeQuotaStatus('gabinete', makeCounter(), 'protocol');
    expect(status.plan_limit).toBe(10);
    expect(status.total_available).toBe(10);
  });

  it('usó 20 de 20 → exhausted', () => {
    const status = computeQuotaStatus(
      'gabinete',
      makeCounter({ skin_diagnosis_used: 20 }),
      'skin_diagnosis'
    );
    expect(status.exhausted).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('usó 21 de 20 (no debería pasar pero defensivo) → remaining = 0', () => {
    const status = computeQuotaStatus(
      'gabinete',
      makeCounter({ skin_diagnosis_used: 21 }),
      'skin_diagnosis'
    );
    expect(status.exhausted).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('con add-on de 50: 20 base + 50 bonus = 70 total', () => {
    const status = computeQuotaStatus(
      'gabinete',
      makeCounter({
        skin_diagnosis_used: 15,
        skin_diagnosis_bonus_quota: 50,
      }),
      'skin_diagnosis'
    );
    expect(status.plan_limit).toBe(20);
    expect(status.bonus).toBe(50);
    expect(status.used).toBe(15);
    expect(status.total_available).toBe(70);
    expect(status.remaining).toBe(55);
    expect(status.exhausted).toBe(false);
  });
});

describe('ai-quota / computeQuotaStatus — Equipo', () => {
  it('Equipo skin_diagnosis: 100 base', () => {
    const status = computeQuotaStatus('equipo', makeCounter(), 'skin_diagnosis');
    expect(status.plan_limit).toBe(100);
  });

  it('Equipo protocol: 40 base', () => {
    const status = computeQuotaStatus('equipo', makeCounter(), 'protocol');
    expect(status.plan_limit).toBe(40);
  });
});

describe('ai-quota / computeQuotaStatus — Grandfathered / Centro (ilimitado)', () => {
  it('grandfathered=true → plan_limit null, total_available null, exhausted false', () => {
    const status = computeQuotaStatus(
      'gabinete',
      makeCounter({ skin_diagnosis_used: 99999 }),
      'skin_diagnosis',
      true
    );
    expect(status.plan_limit).toBe(null);
    expect(status.total_available).toBe(null);
    expect(status.remaining).toBe(null);
    expect(status.exhausted).toBe(false);
  });

  it('plan Centro (limit null) → ilimitado sin grandfathered', () => {
    const status = computeQuotaStatus(
      'centro',
      makeCounter({ skin_diagnosis_used: 50000 }),
      'skin_diagnosis'
    );
    expect(status.plan_limit).toBe(null);
    expect(status.total_available).toBe(null);
    expect(status.exhausted).toBe(false);
  });
});
