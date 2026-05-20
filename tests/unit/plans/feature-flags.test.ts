import { describe, it, expect } from 'vitest';
import {
  canAccessFeature,
  planHasFeature,
  getEnabledFeatures,
  getPlansThatUnlock,
} from '@/lib/plans/feature-flags';

describe('feature-flags / planHasFeature', () => {
  it('Gabinete NO tiene multi_usuario', () => {
    expect(planHasFeature('gabinete', 'multi_usuario')).toBe(false);
  });

  it('Equipo SÍ tiene multi_usuario', () => {
    expect(planHasFeature('equipo', 'multi_usuario')).toBe(true);
  });

  it('Equipo tiene inventario', () => {
    expect(planHasFeature('equipo', 'inventario')).toBe(true);
  });

  it('Gabinete no tiene inventario', () => {
    expect(planHasFeature('gabinete', 'inventario')).toBe(false);
  });
});

describe('feature-flags / canAccessFeature', () => {
  it('Gabinete normal → no puede acceder a inventario', () => {
    expect(
      canAccessFeature({ planId: 'gabinete', isGrandfathered: false }, 'inventario')
    ).toBe(false);
  });

  it('Equipo normal → puede acceder a inventario', () => {
    expect(
      canAccessFeature({ planId: 'equipo', isGrandfathered: false }, 'inventario')
    ).toBe(true);
  });

  it('Gabinete GRANDFATHERED → SÍ puede acceder a inventario (override)', () => {
    expect(
      canAccessFeature({ planId: 'gabinete', isGrandfathered: true }, 'inventario')
    ).toBe(true);
  });

  it('Gabinete grandfathered → puede acceder a TODAS las features', () => {
    const ctx = { planId: 'gabinete' as const, isGrandfathered: true };
    expect(canAccessFeature(ctx, 'multi_usuario')).toBe(true);
    expect(canAccessFeature(ctx, 'dashboard_empleadas')).toBe(true);
    expect(canAccessFeature(ctx, 'comisiones')).toBe(true);
    expect(canAccessFeature(ctx, 'inventario')).toBe(true);
    expect(canAccessFeature(ctx, 'reportes_avanzados')).toBe(true);
    expect(canAccessFeature(ctx, 'soporte_prioritario')).toBe(true);
  });
});

describe('feature-flags / getEnabledFeatures', () => {
  it('Gabinete normal → lista vacía', () => {
    expect(getEnabledFeatures({ planId: 'gabinete', isGrandfathered: false })).toEqual([]);
  });

  it('Equipo normal → 6 features', () => {
    const features = getEnabledFeatures({ planId: 'equipo', isGrandfathered: false });
    expect(features).toContain('multi_usuario');
    expect(features).toContain('inventario');
    expect(features.length).toBe(6);
  });

  it('Grandfathered (cualquier plan) → todas', () => {
    const features = getEnabledFeatures({ planId: 'gabinete', isGrandfathered: true });
    expect(features.length).toBe(6);
  });
});

describe('feature-flags / getPlansThatUnlock', () => {
  it('inventario → solo Equipo (Centro está oculto en UI)', () => {
    const plans = getPlansThatUnlock('inventario');
    expect(plans.map((p) => p.id)).toEqual(['equipo']);
  });

  it('comisiones → Equipo solamente en UI', () => {
    const plans = getPlansThatUnlock('comisiones');
    expect(plans.length).toBe(1);
    expect(plans[0]?.id).toBe('equipo');
  });
});
