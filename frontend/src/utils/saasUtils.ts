export type BillingUnit = 'users' | 'agents' | 'seats';

export interface SubscriptionLine {
  product: string;
  seatCount: number;
  billingUnit: BillingUnit;
  amount: number;
  listPrice?: number;
}

export function parseSeatFromText(text?: string | null): { seatCount: number; billingUnit: BillingUnit } | null {
  if (!text?.trim()) return null;
  const agents = text.match(/(\d+)\s*agents?\b/i);
  if (agents) return { seatCount: parseInt(agents[1], 10), billingUnit: 'agents' };
  const users = text.match(/(\d+)\s*users?\b/i);
  if (users) return { seatCount: parseInt(users[1], 10), billingUnit: 'users' };
  const seats = text.match(/(\d+)\s*seats?\b/i);
  if (seats) return { seatCount: parseInt(seats[1], 10), billingUnit: 'seats' };
  return null;
}

export function formatBillingSeats(seats?: number | null, unit?: string | null): string {
  if (!seats || seats <= 0) return '—';
  const u = (unit || 'seats').toLowerCase();
  const label = u === 'agents' ? 'agents' : u === 'users' ? 'users' : 'seats';
  return `${seats} ${label}`;
}

/** Subscription invoice when parsed metadata contains structured line items — not vendor name guesses. */
export function isSubscriptionInvoice(_vendorName?: string | null, metadata?: unknown): boolean {
  if (typeof metadata === 'string') {
    return readSubscriptionLines(metadata).length > 0;
  }
  if (metadata && typeof metadata === 'object' && metadata !== null) {
    const lines = (metadata as { subscriptionLines?: unknown[] }).subscriptionLines;
    return Array.isArray(lines) && lines.length > 0;
  }
  return false;
}

export function readSubscriptionLines(metadata?: string | null): SubscriptionLine[] {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata) as { subscriptionLines?: SubscriptionLine[] };
    return Array.isArray(parsed.subscriptionLines) ? parsed.subscriptionLines : [];
  } catch {
    return [];
  }
}

export function billingUnitLabel(unit?: string | null): string {
  const u = (unit || 'seats').toLowerCase();
  if (u === 'agents') return 'Agents';
  if (u === 'users') return 'Users';
  return 'Seats';
}
