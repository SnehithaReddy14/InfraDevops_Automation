import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MonthPeriodFilter, type MonthPeriodValue } from './MonthPeriodFilter';
import { isWithinMonthRange } from '../utils/monthPeriod';

export interface BillingColumn {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'period';
  group?: string;
  groupSubLabel?: string;
  align?: 'left' | 'right';
  currency?: string;
}

export interface BillingViewPanel {
  id: string;
  title: string;
  layout: string;
  columns: BillingColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | null>;
}

export interface BillingView {
  projectName: string;
  tool: string;
  layout: string;
  currency: string;
  secondaryCurrency?: string;
  title: string;
  subtitle?: string;
  columns: BillingColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | null>;
  services?: string[];
  chartData?: { month: string; amount: number }[];
  fxInrPerUsd?: number;
  panels?: BillingViewPanel[];
}

const GROUP_COLORS = [
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-violet-100 text-violet-900 border-violet-200',
  'bg-rose-100 text-rose-900 border-rose-200',
  'bg-orange-100 text-orange-900 border-orange-200',
];

function formatCell(
  value: string | number | null | undefined,
  type: string,
  currency: string
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    const sym = currency === 'INR' ? '₹' : '$';
    if (n === 0) return `${sym}0.00`;
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(value);
}

function cellCurrency(
  col: BillingColumn,
  row: Record<string, string | number | null>,
  defaultCurrency: string
): string {
  if (col.currency) return col.currency;
  if (col.type === 'currency' && typeof row._currency === 'string') return row._currency;
  return defaultCurrency;
}

function getRowMonthLabel(
  row: Record<string, string | number | null>,
  columns: BillingColumn[]
): string | null {
  const monthCol = columns.find(
    (c) => c.key === 'month' || c.type === 'period' || /month|period/i.test(c.label)
  );
  if (monthCol && row[monthCol.key] != null) return String(row[monthCol.key]);
  if (row.month != null) return String(row.month);
  return null;
}

function filterRowsByPeriod<T extends Record<string, string | number | null>>(
  rows: T[],
  columns: BillingColumn[],
  period: MonthPeriodValue
): T[] {
  if (!period.fromMonth && !period.toMonth) return rows;
  return rows.filter((row) => isWithinMonthRange(getRowMonthLabel(row, columns), period.fromMonth, period.toMonth));
}

function recomputeTotals(
  rows: Record<string, string | number | null>[],
  columns: BillingColumn[],
  totals?: Record<string, number | null>
): Record<string, number | null> | undefined {
  if (!totals) return undefined;
  const next: Record<string, number | null> = { ...totals };
  columns.forEach((col) => {
    if (col.type === 'currency') {
      next[col.key] = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
    }
  });
  return next;
}

function BillingTable({
  title,
  subtitle,
  columns,
  rows,
  totals,
  currency,
  accent = 'orange',
}: {
  title: string;
  subtitle?: string;
  columns: BillingColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | null>;
  currency: string;
  accent?: 'orange' | 'blue' | 'green';
}) {
  const accentMap = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-600',
    green: 'bg-emerald-600',
  };

  const hasGroups = columns.some((c) => c.group);

  /** Top header row cells when column groups exist */
  const topHeaderCells: Array<
    | { kind: 'rowspan'; col: BillingColumn }
    | { kind: 'group'; label: string; span: number; colorIdx: number }
  > = [];

  if (hasGroups) {
    let idx = 0;
    let colorIdx = 0;
    while (idx < columns.length) {
      const col = columns[idx];
      if (!col.group) {
        topHeaderCells.push({ kind: 'rowspan', col });
        idx += 1;
        continue;
      }
      const label = col.group;
      let span = 0;
      while (idx < columns.length && columns[idx].group === label) {
        span += 1;
        idx += 1;
      }
      topHeaderCells.push({ kind: 'group', label, span, colorIdx: colorIdx % GROUP_COLORS.length });
      colorIdx += 1;
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className={`${accentMap[accent]} px-4 py-2`}>
        <h3 className="text-white font-black text-sm">{title}</h3>
        {subtitle && <p className="text-white/80 text-[10px] mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px] min-w-max">
          <thead>
            {hasGroups && (
              <tr>
                {topHeaderCells.map((cell, i) =>
                  cell.kind === 'rowspan' ? (
                    <th
                      key={i}
                      rowSpan={2}
                      className="border border-slate-300 px-3 py-2 text-[10px] font-black uppercase bg-slate-100 text-slate-700"
                    >
                      {cell.col.label}
                    </th>
                  ) : (
                    <th
                      key={i}
                      colSpan={cell.span}
                      className={`border border-slate-300 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-center ${GROUP_COLORS[cell.colorIdx]}`}
                    >
                      {cell.label}
                    </th>
                  )
                )}
              </tr>
            )}
            <tr>
              {(hasGroups ? columns.filter((c) => c.group) : columns).map((col) => (
                <th
                  key={col.key}
                  className={`border border-slate-300 px-3 py-2 font-black uppercase text-[10px] bg-yellow-50 text-slate-800 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border border-slate-200 px-4 py-8 text-center text-slate-400"
                >
                  No invoice data yet — upload invoices to populate this table.
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-50/80">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border border-slate-200 px-3 py-1.5 whitespace-nowrap ${
                        col.align === 'right' || col.type === 'currency' ? 'text-right font-semibold tabular-nums' : ''
                      }`}
                    >
                      {formatCell(row[col.key], col.type, cellCurrency(col, row, currency))}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {totals && rows.length > 0 && (
              <tr className="bg-slate-100 font-black">
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`border border-slate-300 px-3 py-2 ${
                      col.align === 'right' || col.type === 'currency' ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {ci === 0 ? 'TOTALS' : col.type === 'currency' ? formatCell(totals[col.key], 'currency', col.currency || currency) : ''}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface DynamicBillingViewProps {
  view: BillingView | null;
  loading?: boolean;
}

export const DynamicBillingView: React.FC<DynamicBillingViewProps> = ({ view, loading }) => {
  const [period, setPeriod] = useState<MonthPeriodValue>({ fromMonth: null, toMonth: null });

  const filteredMain = useMemo(() => {
    if (!view) return null;
    const rows = filterRowsByPeriod(view.rows, view.columns, period);
    const chartData = view.chartData?.filter((d) => isWithinMonthRange(d.month, period.fromMonth, period.toMonth));
    return {
      rows,
      totals: recomputeTotals(rows, view.columns, view.totals),
      chartData,
    };
  }, [view, period]);

  const filteredPanels = useMemo(() => {
    if (!view?.panels) return [];
    return view.panels.map((panel) => {
      const rows = filterRowsByPeriod(panel.rows, panel.columns, period);
      return { ...panel, rows, totals: recomputeTotals(rows, panel.columns, panel.totals) };
    });
  }, [view?.panels, period]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-semibold">Building billing view from invoices…</span>
      </div>
    );
  }

  if (!view || !filteredMain) return null;

  const showChart =
    filteredMain.chartData &&
    filteredMain.chartData.length > 0 &&
    filteredMain.chartData.some((d) => d.amount > 0);

  return (
    <div className="space-y-6">
      <MonthPeriodFilter value={period} onChange={setPeriod} compact />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
          {view.tool}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          Layout: {view.layout.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] font-bold text-slate-400">
          {filteredMain.rows.length} period{filteredMain.rows.length !== 1 ? 's' : ''} ·{' '}
          {view.secondaryCurrency ? `${view.currency} + ${view.secondaryCurrency}` : view.currency}
        </span>
      </div>

      <div className={`grid gap-6 ${showChart ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
        <BillingTable
          title={view.title}
          subtitle={view.subtitle}
          columns={view.columns}
          rows={filteredMain.rows}
          totals={filteredMain.totals}
          currency={view.currency}
          accent={view.layout === 'resource_matrix' ? 'green' : view.layout === 'category_matrix' ? 'blue' : 'orange'}
        />

        {showChart && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h4 className="font-black text-slate-800 text-xs mb-3">Monthly Trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filteredMain.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, 'Cost (USD)']}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {view.services && view.services.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-blue-600 px-4 py-2">
            <h3 className="text-white font-black text-sm">Services on Invoice</h3>
          </div>
          <div className="p-4">
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-[11px] text-slate-700">
              {view.services.map((svc, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-slate-400 font-bold">{i + 1}.</span>
                  <span>{svc}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {filteredPanels.map((panel) => (
        <BillingTable
          key={panel.id}
          title={panel.title}
          columns={panel.columns}
          rows={panel.rows}
          totals={panel.totals}
          currency={view.currency}
          accent="blue"
        />
      ))}
    </div>
  );
};

export default DynamicBillingView;
