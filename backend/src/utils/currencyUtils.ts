import { getInrPerUsd } from '../services/exchangeRateService';

export type NormalizedCurrency = 'INR' | 'USD';

/** Normalize scraped / stored currency codes to INR or USD. */
export function normalizeCurrency(raw: string | null | undefined): NormalizedCurrency {
  const c = (raw || 'USD').toUpperCase().trim();
  if (c === 'USD' || c === '$' || c.includes('DOLLAR') || c.includes('US D')) return 'USD';
  if (c === 'INR' || c.includes('RUPEE') || c === 'RS' || c === 'RS.') return 'INR';
  return 'USD';
}

export function toUsd(amount: number, from: NormalizedCurrency, inrPerUsd?: number): number {
  if (from === 'USD') return amount;
  const rate = inrPerUsd ?? getInrPerUsd();
  return rate > 0 ? amount / rate : amount;
}

export function toInr(amount: number, from: NormalizedCurrency, inrPerUsd?: number): number {
  if (from === 'INR') return amount;
  const rate = inrPerUsd ?? getInrPerUsd();
  return amount * rate;
}

/** Detect currency from invoice PDF/OCR text. */
export function detectCurrencyFromText(text: string): NormalizedCurrency {
  const sample = text.slice(0, 12000);
  const hasInr = /[₹]|(?:\bINR\b)|(?:\bRs\.?\b)|rupee/i.test(sample);
  const hasUsd = /\bUSD\b|US\s*\$|\$\s*[\d,]+/i.test(sample);
  if (hasUsd && !hasInr) return 'USD';
  if (hasInr) return 'INR';
  if (hasUsd) return 'USD';
  return 'USD';
}

/** Attach normalized currency + INR/USD totals to invoice metadata. */
export function enrichMetadataWithTotals(
  metadata: Record<string, unknown>,
  currency: string | null | undefined,
  grandTotal: number
): Record<string, unknown> {
  const cur = normalizeCurrency(currency);
  const rate = getInrPerUsd();
  const enriched: Record<string, unknown> = { ...metadata, currency: cur, fxInrPerUsd: rate };

  if (cur === 'USD') {
    enriched.totalCostUsd = grandTotal;
    enriched.totalCostInr = toInr(grandTotal, 'USD', rate);
  } else {
    enriched.totalCostInr = grandTotal;
    enriched.totalCostUsd = toUsd(grandTotal, 'INR', rate);
  }

  return enriched;
}

export interface CurrencyContext {
  hasInr: boolean;
  hasUsd: boolean;
  primaryCurrency: NormalizedCurrency;
  secondaryCurrency?: 'USD';
}

export function buildCurrencyContext(
  entries: Array<{ currency: string | null | undefined }>
): CurrencyContext {
  const normalized = entries.map((e) => normalizeCurrency(e.currency));
  const hasInr = normalized.includes('INR');
  const hasUsd = normalized.includes('USD');
  return {
    hasInr,
    hasUsd,
    primaryCurrency: hasInr ? 'INR' : hasUsd ? 'USD' : 'USD',
    secondaryCurrency: hasInr ? 'USD' : undefined,
  };
}

export function currencySubtitle(ctx: CurrencyContext, inrPerUsd?: number): string {
  const rate = inrPerUsd ?? getInrPerUsd();
  const rateNote = ctx.hasInr ? ` · USD converted at ₹${rate.toFixed(2)} per $1 (live rate)` : '';

  if (ctx.hasInr && ctx.hasUsd) {
    return `Amounts in invoice currency; INR rows show USD equivalent${rateNote}`;
  }
  if (ctx.hasInr) return `Amounts in INR with USD equivalent in summary${rateNote}`;
  return 'Amounts in invoice currency (USD)';
}

export function resolveNativeAndUsdTotals(
  currency: NormalizedCurrency,
  grandTotal: number
): { nativeTotal: number; usdTotal: number } {
  const nativeTotal = grandTotal;
  const usdTotal = currency === 'USD' ? nativeTotal : toUsd(nativeTotal, 'INR');
  return { nativeTotal, usdTotal };
}
