const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

function monthIndex(name: string): number {
  const key = name.slice(0, 3).toLowerCase();
  return MONTH_NAMES.indexOf(key);
}

/** Parse billing month labels (Jan 2026, Jan-26, 2026-01) to a Date at day 1. */
export function parseMonthToDate(label: string | null | undefined): Date | null {
  if (!label?.trim()) return null;
  const s = label.trim();

  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }

  const dash = s.match(/^([A-Za-z]{3,9})[-/\s]+(\d{2,4})$/);
  if (dash) {
    const idx = monthIndex(dash[1]);
    let year = parseInt(dash[2], 10);
    if (year < 100) year += 2000;
    if (idx >= 0) return new Date(year, idx, 1);
  }

  const spaced = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (spaced) {
    const idx = monthIndex(spaced[1]);
    const year = parseInt(spaced[2], 10);
    if (idx >= 0) return new Date(year, idx, 1);
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  return null;
}

export function monthSortKey(label: string): number {
  return parseMonthToDate(label)?.getTime() ?? 0;
}

/** Compare YYYY-MM input values against a billing month label. */
export function isWithinMonthRange(
  label: string | null | undefined,
  fromMonth: string | null,
  toMonth: string | null
): boolean {
  if (!fromMonth && !toMonth) return true;

  const date = parseMonthToDate(label);
  if (!date) return true;

  if (fromMonth) {
    const [y, m] = fromMonth.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    if (date < from) return false;
  }

  if (toMonth) {
    const [y, m] = toMonth.split('-').map(Number);
    const to = new Date(y, m, 0, 23, 59, 59);
    if (date > to) return false;
  }

  return true;
}

/** First / last calendar day for month inputs (InvoiceList API filters). */
export function monthRangeToDateBounds(fromMonth: string | null, toMonth: string | null) {
  let startDate = '';
  let endDate = '';

  if (fromMonth) {
    startDate = `${fromMonth}-01`;
  }
  if (toMonth) {
    const [y, m] = toMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    endDate = `${toMonth}-${String(lastDay).padStart(2, '0')}`;
  }

  return { startDate, endDate };
}

export function formatMonthInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Preset: last N months through current month. */
export function lastNMonthsRange(n: number): { fromMonth: string; toMonth: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - (n - 1), 1);
  return { fromMonth: formatMonthInput(from), toMonth: formatMonthInput(to) };
}
