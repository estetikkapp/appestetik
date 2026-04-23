import type { IAfipProvider, InvoiceRequest, InvoiceResult } from './types';
import { NotImplementedError } from './types';

/**
 * Provider manual: emite un "comprobante interno no fiscal" en PDF con marca de agua.
 * Se usa como fallback cuando el centro todavía no configuró AFIP.
 *
 * Stub en Sprint 1a — no hay cobros todavía así que no se invoca. La impl real
 * (generación de PDF con @react-pdf/renderer) llega en Sprint 4.
 */
export class ManualAfipProvider implements IAfipProvider {
  readonly name = 'manual' as const;

  async emit(_request: InvoiceRequest): Promise<InvoiceResult> {
    throw new NotImplementedError('ManualAfipProvider.emit() — Sprint 4');
  }

  async voidInvoice(_invoiceId: string, _reason: string): Promise<void> {
    throw new NotImplementedError('ManualAfipProvider.voidInvoice() — Sprint 4');
  }

  async fetchInvoice(_invoiceId: string): Promise<InvoiceResult> {
    throw new NotImplementedError('ManualAfipProvider.fetchInvoice() — Sprint 4');
  }
}
