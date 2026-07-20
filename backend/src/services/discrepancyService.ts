/**
 * Compares invoiced line items / metadata against project CloudResource scope.
 * Flags services on bills that are not recorded in the project inventory.
 */

export type DiscrepancySeverity = 'warning' | 'info';

export interface ScopedResource {
  id: number;
  instanceName: string;
  resourceType: string;
  tool: string;
  monthlyCost: number;
  environment?: string;
}

export interface BilledService {
  label: string;
  totalAmount: number;
  invoiceIds: number[];
  invoiceNumbers: string[];
}

export interface DiscrepancyItem {
  id: string;
  type: 'unscoped_on_invoice' | 'scoped_not_on_invoice' | 'cost_variance';
  severity: DiscrepancySeverity;
  title: string;
  detail: string;
  billedAmount?: number;
  scopedAmount?: number;
  invoiceNumbers?: string[];
  resourceId?: number;
}

export interface BillingDiscrepancyReport {
  projectId: number;
  scopedResourceCount: number;
  billedServiceCount: number;
  totalInvoiced: number;
  totalScopedMonthlyCost: number;
  costVariance: number;
  items: DiscrepancyItem[];
}

interface InvoiceInput {
  id: number;
  invoiceNumber: string;
  grandTotal: number;
  metadata: string | null;
  extractedJson: string | null;
  items?: Array<{ description: string; amount: number }>;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value: string): string[] {
  return normalizeToken(value).split(/\s+/).filter((t) => t.length > 1);
}

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Metadata keys that are totals, layout, or FX — not billable line services. */
const META_SKIP_KEYS = new Set([
  'invoiceNumber',
  'invoiceDate',
  'billingPeriod',
  'billingMonth',
  'vendorName',
  'currency',
  'totalCostInr',
  'totalCostUsd',
  'totalCost',
  'confidenceScore',
  'grandTotal',
  'subtotal',
  'tax',
  'discount',
  'shipping',
  'lineItems',
  'billingColumns',
  'columnLabels',
  'products',
  'nodes',
  'services',
  'fxInrPerUsd',
  'fxUsdPerInr',
  'exchangeRate',
  'inrPerUsd',
  'usdPerInr',
]);

/** FX / currency conversion fields are not infrastructure charges. */
export function isFxOrCurrencyField(rawKey: string, label?: string): boolean {
  if (META_SKIP_KEYS.has(rawKey)) return true;

  const normalized = normalizeToken(`${rawKey} ${label ?? ''}`);
  if (/^fx/.test(normalizeToken(rawKey).replace(/\s/g, ''))) return true;
  if (/fx|exchange rate|currency conversion|inr per usd|usd per inr|forex|conversion rate/.test(normalized)) {
    return true;
  }
  if (/total|grand|subtotal|tax|discount|shipping|confidence/.test(normalized)) return true;

  return false;
}

/** Collect billed service labels from invoice items and metadata keys with amounts. */
export function extractBilledServices(invoices: InvoiceInput[]): BilledService[] {
  const map = new Map<string, BilledService>();

  const add = (label: string, amount: number, inv: InvoiceInput, rawKey?: string) => {
    if (isFxOrCurrencyField(rawKey ?? label, label)) return;
    const key = normalizeToken(label);
    if (!key) return;
    const existing = map.get(key);
    if (existing) {
      existing.totalAmount += amount;
      if (!existing.invoiceIds.includes(inv.id)) {
        existing.invoiceIds.push(inv.id);
        existing.invoiceNumbers.push(inv.invoiceNumber);
      }
    } else {
      map.set(key, {
        label: label.trim(),
        totalAmount: amount,
        invoiceIds: [inv.id],
        invoiceNumbers: [inv.invoiceNumber],
      });
    }
  };

  for (const inv of invoices) {
    inv.items?.forEach((item) => {
      if (item.description?.trim()) add(item.description, item.amount, inv);
    });

    const meta = parseMeta(inv.metadata || inv.extractedJson);
    for (const [key, val] of Object.entries(meta)) {
      if (typeof val !== 'number' || val <= 0) continue;
      if (isFxOrCurrencyField(key)) continue;
      if (/^node\d+(charges|cdp)$/i.test(key)) continue;
      add(key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' '), val, inv, key);
    }
  }

  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}

function resourceMatchesBilled(resource: ScopedResource, billedKey: string, billedLabel: string): boolean {
  const typeKey = normalizeToken(resource.resourceType);
  const nameKey = normalizeToken(resource.instanceName);
  const labelKey = normalizeToken(billedLabel);

  if (!typeKey && !nameKey) return false;
  if (nameKey && (labelKey.includes(nameKey) || billedKey.includes(nameKey))) return true;
  if (typeKey && (labelKey.includes(typeKey) || billedKey.includes(typeKey))) return true;

  const typeTokens = tokens(resource.resourceType);
  const nameTokens = tokens(resource.instanceName);
  const billTokens = tokens(billedLabel);
  const significant = [...typeTokens, ...nameTokens].filter((t) => t.length > 2);
  if (significant.length === 0) return false;
  const hits = significant.filter((t) => billTokens.some((b) => b.includes(t) || t.includes(b)));
  return hits.length >= Math.min(2, significant.length);
}

function billedMatchesResource(billed: BilledService, resource: ScopedResource): boolean {
  const key = normalizeToken(billed.label);
  return resourceMatchesBilled(resource, key, billed.label);
}

export function buildDiscrepancyReport(
  projectId: number,
  resources: ScopedResource[],
  invoices: InvoiceInput[]
): BillingDiscrepancyReport {
  const billedServices = extractBilledServices(invoices);
  const totalInvoiced = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalScopedMonthlyCost = resources.reduce((s, r) => s + r.monthlyCost, 0);
  const items: DiscrepancyItem[] = [];

  for (const billed of billedServices) {
    const matched = resources.some((r) => billedMatchesResource(billed, r));
    if (!matched) {
      items.push({
        id: `unscoped-${normalizeToken(billed.label)}`,
        type: 'unscoped_on_invoice',
        severity: 'warning',
        title: billed.label,
        detail: 'Appears on invoice(s) but is not in the project infrastructure scope.',
        billedAmount: billed.totalAmount,
        invoiceNumbers: billed.invoiceNumbers,
      });
    }
  }

  for (const resource of resources) {
    const matched = billedServices.some((b) => billedMatchesResource(b, resource));
    if (!matched && resource.monthlyCost > 0) {
      items.push({
        id: `missing-${resource.id}`,
        type: 'scoped_not_on_invoice',
        severity: 'info',
        title: `${resource.instanceName} (${resource.resourceType})`,
        detail: 'Recorded in project scope but not matched on any uploaded invoice line item.',
        scopedAmount: resource.monthlyCost,
        resourceId: resource.id,
      });
    }
  }

  const costVariance = totalInvoiced - totalScopedMonthlyCost;
  if (resources.length > 0 && invoices.length > 0 && Math.abs(costVariance) > 1) {
    items.push({
      id: 'cost-variance',
      type: 'cost_variance',
      severity: Math.abs(costVariance) > totalScopedMonthlyCost * 0.1 ? 'warning' : 'info',
      title: 'Total cost variance',
      detail:
        costVariance > 0
          ? 'Invoiced total exceeds sum of scoped resource monthly costs.'
          : 'Scoped resource costs exceed invoiced total.',
      billedAmount: totalInvoiced,
      scopedAmount: totalScopedMonthlyCost,
    });
  }

  return {
    projectId,
    scopedResourceCount: resources.length,
    billedServiceCount: billedServices.length,
    totalInvoiced,
    totalScopedMonthlyCost,
    costVariance,
    items,
  };
}
