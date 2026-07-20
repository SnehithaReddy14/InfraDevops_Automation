/** Extended invoice fields stored inside metadata.details (not dedicated DB columns). */
export const INVOICE_DETAIL_FIELDS = [
  'dueDate',
  'vendorAddress',
  'vendorEmail',
  'vendorPhone',
  'customerName',
  'customerAddress',
  'customerEmail',
  'customerPhone',
  'gstNumber',
  'vatNumber',
  'purchaseOrder',
  'paymentTerms',
] as const;

export type InvoiceDetailField = (typeof INVOICE_DETAIL_FIELDS)[number];

type JsonRecord = Record<string, unknown>;

function parseMetadata(raw: string | null | undefined): JsonRecord {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as JsonRecord) : {};
  } catch {
    return {};
  }
}

export function extractInvoiceDetails(source: JsonRecord): JsonRecord {
  const details: JsonRecord = {};
  for (const field of INVOICE_DETAIL_FIELDS) {
    if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
      details[field] = source[field];
    }
  }
  return details;
}

/** Split API payload into core invoice columns + metadata.details blob. */
export function splitInvoicePayload(data: JsonRecord): {
  core: JsonRecord;
  metadataJson: string | null;
} {
  const core: JsonRecord = { ...data };
  const details = extractInvoiceDetails(data);

  for (const field of INVOICE_DETAIL_FIELDS) {
    delete core[field];
  }

  let metadata = parseMetadata(typeof data.metadata === 'string' ? data.metadata : undefined);
  if (Object.keys(details).length > 0) {
    metadata = { ...metadata, details: { ...(metadata.details as JsonRecord), ...details } };
  }

  const metadataJson = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
  return { core, metadataJson };
}

/** Merge metadata.details back onto invoice for API responses (InvoiceDetail UI). */
export function enrichInvoice<T extends { metadata?: string | null }>(invoice: T): T & JsonRecord {
  const metadata = parseMetadata(invoice.metadata);
  const details = (metadata.details as JsonRecord) || {};
  const enriched: JsonRecord = { ...invoice, ...details };

  if (details.dueDate && typeof details.dueDate === 'string') {
    enriched.dueDate = details.dueDate;
  }

  return enriched as T & JsonRecord;
}

export function enrichInvoices<T extends { metadata?: string | null }>(invoices: T[]): Array<T & JsonRecord> {
  return invoices.map(enrichInvoice);
}
