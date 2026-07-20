/**
 * Builds dynamic, spreadsheet-style billing views from uploaded invoices.
 * Layout adapts to parsed metadata shape — no hardcoded project names.
 */

import {
  buildCurrencyContext,
  currencySubtitle,
  normalizeCurrency,
  resolveNativeAndUsdTotals,
  type CurrencyContext,
  type NormalizedCurrency,
} from '../utils/currencyUtils';
import { getInrPerUsd } from '../services/exchangeRateService';
import { isFxOrCurrencyField } from './discrepancyService';

export interface BillingColumn {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'period';
  group?: string;
  groupSubLabel?: string;
  align?: 'left' | 'right';
  /** Override display currency for this column (e.g. USD summary column). */
  currency?: string;
}

export interface BillingViewPanel {
  id: string;
  title: string;
  layout: BillingViewLayout;
  columns: BillingColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | null>;
}

export type BillingViewLayout =
  | 'monthly_summary'
  | 'category_matrix'
  | 'resource_matrix'
  | 'multi_product'
  | 'invoice_ledger';

interface ResourceGroup {
  group: string;
  subLabel?: string;
  metrics: Array<{ key: string; label: string }>;
}

export interface BillingView {
  projectName: string;
  tool: string;
  layout: BillingViewLayout;
  currency: string;
  secondaryCurrency?: string;
  title: string;
  subtitle?: string;
  columns: BillingColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | null>;
  services?: string[];
  chartData?: { month: string; amount: number }[];
  panels?: BillingViewPanel[];
  /** Live INR per 1 USD used for conversions in this view */
  fxInrPerUsd?: number;
}

interface InvoiceRecord {
  id: number;
  invoiceNumber: string;
  invoiceDate: Date | null;
  billingMonth: string | null;
  billingPeriod: string | null;
  grandTotal: number;
  currency: string;
  metadata: string | null;
  extractedJson: string | null;
  items?: Array<{ description: string; amount: number }>;
}

interface ParsedMeta {
  [key: string]: unknown;
}

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function invoiceCurrency(inv: InvoiceRecord, meta: ParsedMeta): NormalizedCurrency {
  return normalizeCurrency(inv.currency || String(meta.currency ?? ''));
}

function getCurrencyContext(invoices: InvoiceRecord[], metas: ParsedMeta[]): CurrencyContext {
  return buildCurrencyContext(
    invoices.map((inv, i) => ({ currency: inv.currency || String(metas[i]?.currency ?? '') }))
  );
}

function appendUsdSummaryColumns(
  columns: BillingColumn[],
  ctx: CurrencyContext,
  nativeKey: string,
  nativeLabel: string,
  group?: string
): void {
  columns.push({
    key: nativeKey,
    label: ctx.hasInr && ctx.hasUsd ? `${nativeLabel} (Invoice Currency)` : nativeLabel,
    type: 'currency',
    group,
    align: 'right',
  });
  if (ctx.hasInr) {
    columns.push({
      key: 'monthlyTotalUsd',
      label: `${nativeLabel} (USD)`,
      type: 'currency',
      currency: 'USD',
      group,
      align: 'right',
    });
  }
}

function appendSummaryTotalsToRow(
  row: Record<string, string | number | null>,
  currency: NormalizedCurrency,
  nativeTotal: number,
  usdTotal: number,
  ctx: CurrencyContext,
  nativeKey = 'monthlyTotalNative'
): void {
  row[nativeKey] = nativeTotal;
  row.monthlyTotalUsd = currency === 'INR' && ctx.hasInr ? usdTotal : null;
}

function parseMeta(raw: string | null): ParsedMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ParsedMeta;
  } catch {
    return {};
  }
}

function metaNumber(meta: ParsedMeta, key: string): number {
  const v = meta[key];
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function monthSortKey(month: string): number {
  const m = month.match(/([A-Za-z]{3})-(\d{2,4})/);
  if (!m) return 9999;
  const mi = MONTH_ORDER.findIndex((x) => x.toLowerCase() === m[1].slice(0, 3).toLowerCase());
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return year * 12 + (mi >= 0 ? mi : 0);
}

function sortMonths(months: string[]): string[] {
  return [...months].sort((a, b) => monthSortKey(a) - monthSortKey(b));
}

function formatMonthLabel(d: Date): string {
  const m = d.toLocaleString('en-US', { month: 'short' });
  const y = d.getFullYear().toString().slice(-2);
  return `${m}-${y}`;
}

function invoiceMonth(inv: InvoiceRecord): string {
  if (inv.billingMonth) return inv.billingMonth;
  if (inv.invoiceDate) return formatMonthLabel(new Date(inv.invoiceDate));
  return 'Unknown';
}

function formatCurrency(amount: number, currency: string): string {
  const sym = currency === 'INR' ? '₹' : '$';
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function humanizeMetaKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const META_SKIP_KEYS = new Set([
  'invoiceNumber', 'invoiceDate', 'billingPeriod', 'billingMonth', 'vendorName', 'currency',
  'totalCostInr', 'totalCostUsd', 'totalCost', 'confidenceScore', 'grandTotal', 'subtotal',
  'tax', 'discount', 'shipping', 'lineItems', 'billingColumns', 'columnLabels', 'products',
  'nodes', 'services', 'subscriptionLines', 'details', 'itsmUsersCost', 'developersCost', 'tempoCost',
  'fxInrPerUsd', 'fxUsdPerInr', 'exchangeRate', 'inrPerUsd', 'usdPerInr',
]);

function isBillableMetadataKey(key: string): boolean {
  if (META_SKIP_KEYS.has(key)) return false;
  if (isFxOrCurrencyField(key)) return false;
  return true;
}

/** Numeric cost fields from invoice metadata (parser-defined or discovered). */
function discoverMetadataCostColumns(metas: ParsedMeta[]): Array<{ key: string; label: string }> {
  const columns = new Map<string, string>();

  for (const meta of metas) {
    if (Array.isArray(meta.billingColumns)) {
      for (const col of meta.billingColumns as Array<{ key?: string; label?: string }>) {
        if (col?.key && col.label) columns.set(col.key, col.label);
      }
    }
    if (meta.columnLabels && typeof meta.columnLabels === 'object') {
      for (const [key, label] of Object.entries(meta.columnLabels as Record<string, string>)) {
        if (label) columns.set(key, label);
      }
    }

    for (const key of Object.keys(meta)) {
      if (!isBillableMetadataKey(key)) continue;
      if (/^node\d+(Charges|Cdp)$/i.test(key)) continue;
      const val = meta[key];
      if (typeof val === 'number' && !Number.isNaN(val)) {
        columns.set(key, columns.get(key) || humanizeMetaKey(key));
      }
    }
  }

  return [...columns.entries()].map(([key, label]) => ({ key, label }));
}

/** Line-item product columns from InvoiceItem descriptions. */
function discoverLineItemColumns(invoices: InvoiceRecord[]): Array<{ key: string; label: string }> {
  const products = new Map<string, string>();
  invoices.forEach((inv) => {
    inv.items?.forEach((item) => {
      const name = item.description?.trim();
      if (!name) return;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
      if (!products.has(slug)) products.set(slug, name);
    });
  });
  return [...products.entries()].map(([key, label]) => ({ key, label }));
}

function slugForLabel(label: string, known: Map<string, string>): string {
  const found = [...known.entries()].find(([, v]) => v === label)?.[0];
  if (found) return found;
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
}

/** Discover E2E-style resource column groups from metadata keys across invoices. */
function discoverResourceGroups(metas: ParsedMeta[]): ResourceGroup[] {
  const allKeys = new Set<string>();
  metas.forEach((m) => Object.keys(m).forEach((k) => allKeys.add(k)));

  const skip = new Set([
    'invoiceNumber', 'invoiceDate', 'billingPeriod', 'billingMonth', 'vendorName', 'currency',
    'totalCostInr', 'totalCostUsd', 'totalCost', 'confidenceScore',
    'fxInrPerUsd', 'fxUsdPerInr', 'exchangeRate', 'inrPerUsd', 'usdPerInr',
  ]);

  const nodeGroups = new Map<string, { charges?: string; cdp?: string }>();
  const singles: Array<{ key: string; label: string }> = [];

  for (const key of allKeys) {
    if (skip.has(key) || !isBillableMetadataKey(key)) continue;
    const nodeMatch = key.match(/^node(\d+)(Charges|Cdp)$/i);
    if (nodeMatch) {
      const n = nodeMatch[1];
      const kind = nodeMatch[2].toLowerCase();
      const gk = `node-${n}`;
      if (!nodeGroups.has(gk)) nodeGroups.set(gk, {});
      const g = nodeGroups.get(gk)!;
      if (kind === 'charges') g.charges = key;
      else g.cdp = key;
      continue;
    }
    if (/charges$|backups$|images$|snapshots$/i.test(key)) {
      singles.push({ key, label: humanizeMetaKey(key) });
    }
  }

  const groups: ResourceGroup[] = [];

  [...nodeGroups.entries()]
    .sort(([a], [b]) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]))
    .forEach(([gk, g]) => {
      const n = gk.split('-')[1];
      const metrics: Array<{ key: string; label: string }> = [];
      if (g.charges) metrics.push({ key: g.charges, label: 'Monthly charges' });
      if (g.cdp) metrics.push({ key: g.cdp, label: 'CDP Charges' });
      if (metrics.length) groups.push({ group: `Node-${n}`, metrics });
    });

  singles.forEach((s) => {
    groups.push({ group: s.label, metrics: [{ key: s.key, label: 'Monthly charges' }] });
  });

  return groups;
}

function discoverNodeBreakdownColumns(metas: ParsedMeta[]): Array<{
  group: string;
  key: string;
  chargesKey?: string;
  cdpKey?: string;
}> {
  const nodeGroups = new Map<string, { charges?: string; cdp?: string }>();

  metas.forEach((meta) => {
    Object.keys(meta).forEach((key) => {
      const nodeMatch = key.match(/^node(\d+)(Charges|Cdp)$/i);
      if (!nodeMatch) return;
      const n = nodeMatch[1];
      const kind = nodeMatch[2].toLowerCase();
      const gk = `node-${n}`;
      if (!nodeGroups.has(gk)) nodeGroups.set(gk, {});
      const g = nodeGroups.get(gk)!;
      if (kind === 'charges') g.charges = key;
      else g.cdp = key;
    });
  });

  return [...nodeGroups.entries()]
    .sort(([a], [b]) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]))
    .map(([gk, g]) => {
      const n = gk.split('-')[1];
      return {
        group: `Node-${n}`,
        key: `node${n}Total`,
        chargesKey: g.charges,
        cdpKey: g.cdp,
      };
    })
    .filter((col) => col.chargesKey || col.cdpKey);
}

function hasResourceMetrics(metas: ParsedMeta[]): boolean {
  return metas.some((m) =>
    Object.keys(m).some((k) => /^node\d+(Charges|Cdp)$/i.test(k) || /charges$|backups$|images$|snapshots$/i.test(k))
  );
}

/** Pick layout from invoice/metadata shape only — no tool-name rules. */
function detectLayout(invoices: InvoiceRecord[], metas: ParsedMeta[]): BillingViewLayout {
  if (hasResourceMetrics(metas)) return 'resource_matrix';

  const lineItems = discoverLineItemColumns(invoices);
  const metaCols = discoverMetadataCostColumns(metas);

  if (lineItems.length > 1) return 'multi_product';
  if (metaCols.length > 1) return 'category_matrix';
  if (lineItems.length === 1) return 'multi_product';
  if (metaCols.length === 1) return 'category_matrix';

  return 'monthly_summary';
}

function buildMonthlySummary(projectName: string, tool: string, invoices: InvoiceRecord[]): BillingView {
  const metas = invoices.map((inv) => parseMeta(inv.metadata || inv.extractedJson));
  const ctx = getCurrencyContext(invoices, metas);
  const amountKey = 'amount';

  const byMonth = new Map<
    string,
    { currency: NormalizedCurrency; nativeTotal: number; usdTotal: number }
  >();

  invoices.forEach((inv, i) => {
    const meta = metas[i];
    const month = invoiceMonth(inv);
    const currency = invoiceCurrency(inv, meta);
    const { nativeTotal, usdTotal } = resolveNativeAndUsdTotals(currency, inv.grandTotal);
    byMonth.set(month, { currency, nativeTotal, usdTotal });
  });

  const months = sortMonths([...byMonth.keys()]);
  const rows = months.map((month) => {
    const data = byMonth.get(month)!;
    const row: Record<string, string | number | null> = {
      month,
      _currency: data.currency,
      [amountKey]: data.nativeTotal,
    };
    appendSummaryTotalsToRow(row, data.currency, data.nativeTotal, data.usdTotal, ctx, amountKey);
    return row;
  });

  const columns: BillingColumn[] = [{ key: 'month', label: 'Month', type: 'text' }];
  appendUsdSummaryColumns(columns, ctx, amountKey, projectName);

  const totals: Record<string, number> = {};
  columns.filter((c) => c.type === 'currency').forEach((c) => {
    if (c.key === 'monthlyTotalUsd') {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r.monthlyTotalUsd) || 0), 0);
    } else {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    }
  });
  totals.month = null as unknown as number;

  const services = new Set<string>();
  invoices.forEach((inv) => {
    inv.items?.forEach((item) => {
      if (item.description?.trim()) services.add(item.description.trim());
    });
    const meta = parseMeta(inv.metadata || inv.extractedJson);
    if (Array.isArray(meta.lineItems)) {
      (meta.lineItems as Array<{ description?: string }>).forEach((li) => {
        if (li.description?.trim()) services.add(li.description.trim());
      });
    }
  });

  return {
    projectName,
    tool,
    layout: 'monthly_summary',
    currency: ctx.primaryCurrency,
    secondaryCurrency: ctx.secondaryCurrency,
    title: `${tool} Billing`,
    subtitle: currencySubtitle(ctx, getInrPerUsd()),
    fxInrPerUsd: getInrPerUsd(),
    columns,
    rows,
    totals,
    services: [...services].sort(),
    chartData: rows.map((r) => ({
      month: String(r.month),
      amount: Number(r.monthlyTotalUsd ?? r[amountKey]) || 0,
    })),
  };
}

function buildCategoryMatrix(projectName: string, tool: string, invoices: InvoiceRecord[]): BillingView {
  const metas = invoices.map((inv) => parseMeta(inv.metadata || inv.extractedJson));
  const ctx = getCurrencyContext(invoices, metas);
  const categories = discoverMetadataCostColumns(metas);

  if (categories.length === 0) {
    return buildMonthlySummary(projectName, tool, invoices);
  }

  const byMonth = new Map<
    string,
    {
      currency: NormalizedCurrency;
      fields: Record<string, number>;
      nativeTotal: number;
      usdTotal: number;
    }
  >();

  invoices.forEach((inv, i) => {
    const meta = metas[i];
    const month = invoiceMonth(inv);
    const currency = invoiceCurrency(inv, meta);
    const fields: Record<string, number> = {};
    categories.forEach((c) => {
      fields[c.key] = metaNumber(meta, c.key);
    });
    const nativeTotal =
      inv.grandTotal ||
      metaNumber(meta, 'totalCost') ||
      metaNumber(meta, 'totalCostUsd') ||
      metaNumber(meta, 'totalCostInr') ||
      categories.reduce((s, c) => s + fields[c.key], 0);
    const { usdTotal } = resolveNativeAndUsdTotals(currency, nativeTotal);

    if (!byMonth.has(month)) {
      byMonth.set(month, { currency, fields: {}, nativeTotal: 0, usdTotal: 0 });
    }
    const bucket = byMonth.get(month)!;
    bucket.nativeTotal += nativeTotal;
    bucket.usdTotal += usdTotal;
    categories.forEach((c) => {
      bucket.fields[c.key] = (bucket.fields[c.key] || 0) + fields[c.key];
    });
  });

  const months = sortMonths([...byMonth.keys()]);
  const rows = months.map((month) => {
    const data = byMonth.get(month)!;
    const row: Record<string, string | number | null> = {
      month,
      _currency: data.currency,
      ...Object.fromEntries(categories.map((c) => [c.key, data.fields[c.key] || 0])),
    };
    appendSummaryTotalsToRow(row, data.currency, data.nativeTotal, data.usdTotal, ctx, 'totalCost');
    return row;
  });

  const columns: BillingColumn[] = [{ key: 'month', label: 'Month', type: 'text' }];
  categories.forEach((c) => {
    columns.push({ key: c.key, label: c.label, type: 'currency', align: 'right' });
  });
  appendUsdSummaryColumns(columns, ctx, 'totalCost', 'Total Cost');

  const totals: Record<string, number> = {};
  columns.filter((c) => c.type === 'currency').forEach((c) => {
    if (c.key === 'monthlyTotalUsd') {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r.monthlyTotalUsd) || 0), 0);
    } else {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    }
  });

  return {
    projectName,
    tool,
    layout: 'category_matrix',
    currency: ctx.primaryCurrency,
    secondaryCurrency: ctx.secondaryCurrency,
    title: `${tool} Billing`,
    subtitle: currencySubtitle(ctx, getInrPerUsd()),
    fxInrPerUsd: getInrPerUsd(),
    columns,
    rows,
    totals,
    chartData: rows.map((r) => ({
      month: String(r.month),
      amount: Number(r.monthlyTotalUsd ?? r.totalCost) || 0,
    })),
  };
}

function buildResourceMatrix(projectName: string, tool: string, invoices: InvoiceRecord[]): BillingView {
  const metas = invoices.map((inv) => parseMeta(inv.metadata || inv.extractedJson));
  const groups = discoverResourceGroups(metas);
  const ctx = getCurrencyContext(invoices, metas);

  const columns: BillingColumn[] = [{ key: 'month', label: 'Month', type: 'text' }];
  groups.forEach((g) => {
    g.metrics.forEach((m) => {
      columns.push({
        key: m.key,
        label: m.label,
        type: 'currency',
        group: g.group,
        groupSubLabel: g.subLabel,
        align: 'right',
      });
    });
  });
  appendUsdSummaryColumns(columns, ctx, 'monthlyTotalNative', 'Monthly Total', 'Summary');

  const byMonth = new Map<
    string,
    {
      currency: NormalizedCurrency;
      fields: Record<string, number>;
      monthlyTotalNative: number;
      monthlyTotalUsd: number;
    }
  >();

  invoices.forEach((inv) => {
    const meta = parseMeta(inv.metadata || inv.extractedJson);
    const month = invoiceMonth(inv);
    const currency = invoiceCurrency(inv, meta);
    const { nativeTotal, usdTotal } = resolveNativeAndUsdTotals(currency, inv.grandTotal);

    const fields: Record<string, number> = {};
    Object.keys(meta).forEach((k) => {
      if (!isBillableMetadataKey(k)) return;
      if (typeof meta[k] === 'number') fields[k] = metaNumber(meta, k);
    });

    byMonth.set(month, { currency, fields, monthlyTotalNative: nativeTotal, monthlyTotalUsd: usdTotal });
  });

  const months = sortMonths([...byMonth.keys()]);
  const rows = months.map((month) => {
    const data = byMonth.get(month)!;
    const row: Record<string, string | number | null> = {
      month,
      _currency: data.currency,
    };
    groups.forEach((g) => {
      g.metrics.forEach((m) => {
        row[m.key] = data.fields[m.key] ?? 0;
      });
    });
    row.monthlyTotalNative = data.monthlyTotalNative;
    appendSummaryTotalsToRow(row, data.currency, data.monthlyTotalNative, data.monthlyTotalUsd, ctx);
    return row;
  });

  const totals: Record<string, number> = {};
  columns.filter((c) => c.type === 'currency').forEach((c) => {
    if (c.key === 'monthlyTotalUsd') {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r.monthlyTotalUsd) || 0), 0);
    } else if (c.key === 'monthlyTotalNative') {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r.monthlyTotalNative) || 0), 0);
    } else {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    }
  });

  const nodePanel = buildNodeBreakdownPanel(invoices, metas);

  return {
    projectName,
    tool,
    layout: 'resource_matrix',
    currency: ctx.primaryCurrency,
    secondaryCurrency: ctx.secondaryCurrency,
    title: `${projectName} — Infrastructure Billing`,
    subtitle: currencySubtitle(ctx, getInrPerUsd()),
    fxInrPerUsd: getInrPerUsd(),
    columns,
    rows,
    totals,
    chartData: rows.map((r) => ({
      month: String(r.month),
      amount: Number(r.monthlyTotalUsd ?? r.monthlyTotalNative) || 0,
    })),
    panels: nodePanel ? [nodePanel] : undefined,
  };
}

function buildNodeBreakdownPanel(
  invoices: InvoiceRecord[],
  metas: ParsedMeta[]
): BillingViewPanel | null {
  const nodeColumns = discoverNodeBreakdownColumns(metas);
  if (!nodeColumns.length) return null;

  const byMonth = new Map<string, Record<string, number>>();
  invoices.forEach((inv) => {
    const meta = parseMeta(inv.metadata || inv.extractedJson);
    const month = invoiceMonth(inv);
    if (!byMonth.has(month)) byMonth.set(month, {});
    const row = byMonth.get(month)!;
    nodeColumns.forEach((col) => {
      const total = metaNumber(meta, col.chargesKey || '') + metaNumber(meta, col.cdpKey || '');
      row[col.key] = (row[col.key] || 0) + total;
    });
  });

  const months = sortMonths([...byMonth.keys()]);
  const columns: BillingColumn[] = [
    { key: 'month', label: 'Month', type: 'text' },
    ...nodeColumns.map((col) => ({
      key: col.key,
      label: col.group.replace('Node-', 'Node '),
      type: 'currency' as const,
      align: 'right' as const,
    })),
  ];

  const rows = months.map((month) => {
    const data = byMonth.get(month)!;
    const inv = invoices.find((i) => invoiceMonth(i) === month);
    const meta = inv ? parseMeta(inv.metadata || inv.extractedJson) : {};
    const currency = inv ? invoiceCurrency(inv, meta) : 'INR';
    return {
      month,
      _currency: currency,
      ...Object.fromEntries(nodeColumns.map((col) => [col.key, data[col.key] || 0])),
    };
  });

  const totals: Record<string, number> = {};
  nodeColumns.forEach((col) => {
    totals[col.key] = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
  });

  return {
    id: 'node-breakdown',
    title: 'Node Breakdown',
    layout: 'category_matrix',
    columns,
    rows,
    totals,
  };
}

function buildMultiProduct(projectName: string, tool: string, invoices: InvoiceRecord[]): BillingView {
  const metas = invoices.map((inv) => parseMeta(inv.metadata || inv.extractedJson));
  const ctx = getCurrencyContext(invoices, metas);

  const productCols = discoverLineItemColumns(invoices);
  if (productCols.length === 0) {
    return buildMonthlySummary(projectName, tool, invoices);
  }

  const productKeys = new Map(productCols.map((c) => [c.key, c.label]));

  const byMonth = new Map<
    string,
    {
      currency: NormalizedCurrency;
      products: Record<string, number>;
      nativeTotal: number;
      usdTotal: number;
    }
  >();

  invoices.forEach((inv, i) => {
    const meta = metas[i];
    const month = invoiceMonth(inv);
    const currency = invoiceCurrency(inv, meta);
    const { nativeTotal, usdTotal } = resolveNativeAndUsdTotals(currency, inv.grandTotal);

    if (!byMonth.has(month)) {
      byMonth.set(month, { currency, products: {}, nativeTotal: 0, usdTotal: 0 });
    }
    const bucket = byMonth.get(month)!;
    bucket.nativeTotal += nativeTotal;
    bucket.usdTotal += usdTotal;

    inv.items?.forEach((item) => {
      const name = item.description?.trim();
      if (!name) return;
      const slug = slugForLabel(name, productKeys);
      bucket.products[slug] = (bucket.products[slug] || 0) + item.amount;
    });
  });

  const months = sortMonths([...byMonth.keys()]);
  const columns: BillingColumn[] = [{ key: 'month', label: 'Month', type: 'text' }];
  productKeys.forEach((label, slug) => {
    columns.push({ key: `${slug}_cost`, label, type: 'currency', align: 'right' });
  });
  appendUsdSummaryColumns(columns, ctx, 'monthlyTotalNative', 'Invoice Total');

  const rows = months.map((month) => {
    const data = byMonth.get(month)!;
    const row: Record<string, string | number | null> = {
      month,
      _currency: data.currency,
    };
    productKeys.forEach((_, slug) => {
      row[`${slug}_cost`] = data.products[slug] ?? 0;
    });
    appendSummaryTotalsToRow(row, data.currency, data.nativeTotal, data.usdTotal, ctx);
    return row;
  });

  const totals: Record<string, number> = {};
  columns.filter((c) => c.type === 'currency').forEach((c) => {
    if (c.key === 'monthlyTotalUsd') {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r.monthlyTotalUsd) || 0), 0);
    } else if (c.key.endsWith('_cost') || c.key === 'monthlyTotalNative') {
      totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    }
  });

  return {
    projectName,
    tool,
    layout: 'multi_product',
    currency: ctx.primaryCurrency,
    secondaryCurrency: ctx.secondaryCurrency,
    title: `${tool} Billing`,
    subtitle: currencySubtitle(ctx, getInrPerUsd()),
    fxInrPerUsd: getInrPerUsd(),
    columns,
    rows,
    totals,
    chartData: rows.map((r) => ({
      month: String(r.month),
      amount: Number(r.monthlyTotalUsd ?? r.monthlyTotalNative) || 0,
    })),
  };
}

export function buildBillingView(
  projectName: string,
  tool: string,
  invoices: InvoiceRecord[]
): BillingView {
  if (!invoices.length) {
    return {
      projectName,
      tool,
      layout: 'monthly_summary',
      currency: 'USD',
      title: `${tool} Billing`,
      subtitle: 'Upload invoices to populate this view',
      columns: [
        { key: 'month', label: 'Month', type: 'text' },
        { key: 'amount', label: projectName, type: 'currency', align: 'right' },
      ],
      rows: [],
      services: [],
      chartData: [],
    };
  }

  const metas = invoices.map((inv) => parseMeta(inv.metadata || inv.extractedJson));
  const layout = detectLayout(invoices, metas);

  switch (layout) {
    case 'resource_matrix':
      return buildResourceMatrix(projectName, tool, invoices);
    case 'category_matrix':
      return buildCategoryMatrix(projectName, tool, invoices);
    case 'multi_product':
      return buildMultiProduct(projectName, tool, invoices);
    default:
      return buildMonthlySummary(projectName, tool, invoices);
  }
}

export { formatCurrency };
