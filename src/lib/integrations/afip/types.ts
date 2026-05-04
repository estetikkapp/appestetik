/**
 * Interfaces compartidas para proveedores de facturación AFIP.
 * Implementaciones concretas:
 *   - tusfacturas.ts  — impl real contra TusFacturas API (Sprint 4)
 *   - direct.ts       — impl contra webservices AFIP directos (Sprint 6+, tier enterprise)
 *   - manual.ts       — comprobante no-fiscal en PDF (fallback, Sprint 4)
 */

export type InvoiceType = 'C' | 'B' | 'A';

/**
 * Configuración AFIP por organización (guardada en organizations.afip_config jsonb).
 * Cada centro carga sus propias credenciales — esto NO se setea como env var global.
 *
 * El usuario corrige bien: cada centro tiene su propia cuenta AFIP / TusFacturas
 * y emite con sus propios datos fiscales. Las credenciales viven en la fila
 * de la organización, no como env var del proyecto.
 */
export interface AfipOrgConfig {
  // TusFacturas (provider más común para MVP)
  api_key?: string;
  api_token?: string;
  user_token?: string;
  // Punto de venta y razón social pueden estar acá o en organizations
  point_of_sale?: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price_ars: number;
}

export interface InvoiceRequest {
  organizationId: string;
  type: InvoiceType;
  clientId: string;
  items: InvoiceItem[];
  total_ars: number;
}

export interface InvoiceResult {
  invoice_id: string;
  cae: string | null; // null para provider 'manual' (comprobante no fiscal)
  cae_due_date: Date | null;
  pdf_url: string;
  is_fiscal: boolean;
  provider_response: Record<string, unknown>;
}

export interface IAfipProvider {
  name: 'tusfacturas' | 'direct' | 'manual';
  emit(request: InvoiceRequest): Promise<InvoiceResult>;
  voidInvoice(invoiceId: string, reason: string): Promise<void>;
  fetchInvoice(invoiceId: string): Promise<InvoiceResult>;
}

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Todavía no implementado: ${feature}. Ver roadmap Sprint 4.`);
    this.name = 'NotImplementedError';
  }
}
