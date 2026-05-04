import type { IAfipProvider, AfipOrgConfig } from './types';
import { ManualAfipProvider } from './manual';

/**
 * Factory que retorna el provider AFIP según configuración de la organización.
 *
 * IMPORTANTE: las credenciales son **per-org** (en organizations.afip_config jsonb).
 * Cada centro carga sus propias credenciales de TusFacturas en /configuracion → AFIP.
 * NO existen env vars globales — cada org factura con su cuenta TusFacturas.
 *
 * @param providerName valor de organizations.afip_provider
 * @param config valor de organizations.afip_config (las credenciales de ese centro)
 */
export function getAfipProvider(
  providerName: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config?: AfipOrgConfig | null
): IAfipProvider {
  switch (providerName) {
    case 'tusfacturas':
      // return new TusFacturasProvider(_config) — impl pendiente
      throw new Error(
        'TusFacturas provider pendiente. Cuando esté listo, leerá las credenciales de organizations.afip_config (per-org).'
      );
    case 'direct':
      // return new DirectAfipProvider(_config) — tier enterprise con certificado AFIP propio
      throw new Error('Direct AFIP provider pendiente (tier enterprise)');
    case 'manual':
    default:
      return new ManualAfipProvider();
  }
}

export type {
  IAfipProvider,
  InvoiceRequest,
  InvoiceResult,
  InvoiceType,
  InvoiceItem,
  AfipOrgConfig,
} from './types';
export { NotImplementedError } from './types';
