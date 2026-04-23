import type { IAfipProvider } from './types';
import { ManualAfipProvider } from './manual';

/**
 * Factory que retorna el provider AFIP según configuración de la organización.
 * En Sprint 1a todos los orgs tienen afip_provider='manual' (default del schema).
 * Sprint 4 agrega el case para 'tusfacturas'.
 */
export function getAfipProvider(providerName: string | null | undefined): IAfipProvider {
  switch (providerName) {
    case 'tusfacturas':
      // return new TusFacturasProvider() — impl en Sprint 4
      throw new Error('TusFacturas provider pendiente de implementar (Sprint 4)');
    case 'direct':
      // return new DirectAfipProvider() — impl en Sprint 6+ tier enterprise
      throw new Error('Direct AFIP provider pendiente de implementar (Sprint 6+)');
    case 'manual':
    default:
      return new ManualAfipProvider();
  }
}

export type { IAfipProvider, InvoiceRequest, InvoiceResult, InvoiceType, InvoiceItem } from './types';
export { NotImplementedError } from './types';
