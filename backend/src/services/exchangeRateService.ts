/**
 * Live INR/USD exchange rate (refreshed hourly).
 * Uses Frankfurter API (ECB-backed rates, close to Google/converter results).
 */

const FALLBACK_INR_PER_USD = parseFloat(process.env.FX_INR_PER_USD || '83.5');
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedInrPerUsd = FALLBACK_INR_PER_USD;
let cachedAt = 0;
let refreshPromise: Promise<number> | null = null;

export function getInrPerUsd(): number {
  return cachedInrPerUsd > 0 ? cachedInrPerUsd : FALLBACK_INR_PER_USD;
}

export async function refreshInrPerUsd(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { rates?: { INR?: number } };
    const rate = Number(data?.rates?.INR);

    if (rate > 0 && !Number.isNaN(rate)) {
      cachedInrPerUsd = rate;
      cachedAt = Date.now();
      console.log(`[FX] Live INR/USD rate updated: ₹${rate.toFixed(4)} per $1`);
      return rate;
    }
  } catch (err: any) {
    console.warn('[FX] Live rate fetch failed, using cached/fallback:', err?.message || err);
  }

  return getInrPerUsd();
}

/** Return cached rate or fetch if stale. */
export async function ensureFreshExchangeRate(): Promise<number> {
  const stale = Date.now() - cachedAt >= CACHE_TTL_MS;
  if (!stale && cachedAt > 0) return getInrPerUsd();

  if (!refreshPromise) {
    refreshPromise = refreshInrPerUsd().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function startExchangeRateRefresh(): void {
  ensureFreshExchangeRate().catch(() => {});
  setInterval(() => {
    ensureFreshExchangeRate().catch(() => {});
  }, CACHE_TTL_MS);
}
