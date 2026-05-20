import { describe, it, expect } from 'vitest';
import {
  getPlanRank,
  isUpgrade,
  isDowngrade,
  getUpgradeChargeAmount,
  getNextPeriodEnd,
  getTrialEndDate,
} from '@/lib/plans/billing-calculations';

describe('billing / ranking', () => {
  it('gabinete < equipo < centro', () => {
    expect(getPlanRank('gabinete')).toBe(1);
    expect(getPlanRank('equipo')).toBe(2);
    expect(getPlanRank('centro')).toBe(3);
  });

  it('isUpgrade gabinete → equipo', () => {
    expect(isUpgrade('gabinete', 'equipo')).toBe(true);
    expect(isUpgrade('equipo', 'gabinete')).toBe(false);
    expect(isUpgrade('gabinete', 'gabinete')).toBe(false);
  });

  it('isDowngrade equipo → gabinete', () => {
    expect(isDowngrade('equipo', 'gabinete')).toBe(true);
    expect(isDowngrade('gabinete', 'equipo')).toBe(false);
  });
});

describe('billing / getUpgradeChargeAmount (decisión 7A: flat)', () => {
  it('gabinete → equipo (mensual) = $25.000', () => {
    // 54990 - 29990 = 25000
    expect(getUpgradeChargeAmount('gabinete', 'equipo', 'monthly')).toBe(25000);
  });

  it('gabinete → equipo (anual) = $250.000', () => {
    // 549900 - 299900 = 250000
    expect(getUpgradeChargeAmount('gabinete', 'equipo', 'yearly')).toBe(250000);
  });

  it('mismo plan → 0', () => {
    expect(getUpgradeChargeAmount('gabinete', 'gabinete', 'monthly')).toBe(0);
  });

  it('downgrade → 0 (no cobra nada acá; el downgrade se difiere)', () => {
    expect(getUpgradeChargeAmount('equipo', 'gabinete', 'monthly')).toBe(0);
  });
});

describe('billing / getNextPeriodEnd (clamp de mes)', () => {
  it('30-ene mensual → 28-feb (año no bisiesto)', () => {
    // 2027 no es bisiesto
    const start = new Date('2027-01-30T12:00:00Z');
    const end = getNextPeriodEnd(start, 'monthly');
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(1); // febrero
    expect(end.getUTCDate()).toBe(28);
  });

  it('29-feb anual → 28-feb año siguiente', () => {
    const start = new Date('2028-02-29T12:00:00Z'); // 2028 es bisiesto
    const end = getNextPeriodEnd(start, 'yearly');
    expect(end.getUTCFullYear()).toBe(2029);
    expect(end.getUTCMonth()).toBe(1); // febrero
    expect(end.getUTCDate()).toBe(28); // 2029 no es bisiesto
  });

  it('15-mar mensual → 15-abr', () => {
    const start = new Date('2026-03-15T10:00:00Z');
    const end = getNextPeriodEnd(start, 'monthly');
    expect(end.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('15-jun anual → 15-jun siguiente año', () => {
    const start = new Date('2026-06-15T10:00:00Z');
    const end = getNextPeriodEnd(start, 'yearly');
    expect(end.toISOString().slice(0, 10)).toBe('2027-06-15');
  });

  it('31-dic mensual → 31-ene año siguiente', () => {
    const start = new Date('2026-12-31T00:00:00Z');
    const end = getNextPeriodEnd(start, 'monthly');
    expect(end.toISOString().slice(0, 10)).toBe('2027-01-31');
  });
});

describe('billing / getTrialEndDate', () => {
  it('+30 días', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = getTrialEndDate(start, 30);
    expect(end.toISOString().slice(0, 10)).toBe('2026-05-31');
  });

  it('+7 días', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = getTrialEndDate(start, 7);
    expect(end.toISOString().slice(0, 10)).toBe('2026-05-08');
  });
});
