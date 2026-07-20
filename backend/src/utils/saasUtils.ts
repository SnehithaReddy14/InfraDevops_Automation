export type BillingUnit = 'users' | 'agents' | 'seats';

export interface JiraSubscriptionLine {
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

export function subscriptionLinesToInvoiceItems(lines: JiraSubscriptionLine[]) {
  return lines.map((line) => ({
    description: line.product,
    quantity: line.seatCount,
    unitPrice:
      line.seatCount > 0
        ? Math.round((line.amount / line.seatCount) * 100) / 100
        : line.amount,
    amount: line.amount,
  }));
}
