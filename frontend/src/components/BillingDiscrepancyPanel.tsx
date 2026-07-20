import React from 'react';
import { AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface DiscrepancyItem {
  id: string;
  type: 'unscoped_on_invoice' | 'scoped_not_on_invoice' | 'cost_variance';
  severity: 'warning' | 'info';
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

function formatUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const BillingDiscrepancyPanel: React.FC<{
  report: BillingDiscrepancyReport | null;
  loading: boolean;
  projectId: number;
}> = ({ report, loading, projectId }) => {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse h-32" />
    );
  }

  if (!report) return null;

  const warnings = report.items.filter((i) => i.severity === 'warning');
  const unscoped = report.items.filter((i) => i.type === 'unscoped_on_invoice');

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="font-black text-sm text-slate-800">Billing Discrepancy Check</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Invoice line items vs project infrastructure scope
          </p>
        </div>
        {unscoped.length > 0 ? (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
            {unscoped.length} unscoped on bill
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
            No unscoped charges
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center border-b border-slate-100">
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Scoped resources</p>
          <p className="text-lg font-black text-slate-800">{report.scopedResourceCount}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Billed services</p>
          <p className="text-lg font-black text-slate-800">{report.billedServiceCount}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Invoiced</p>
          <p className="text-lg font-black text-slate-800">{formatUsd(report.totalInvoiced)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Scope / mo</p>
          <p className="text-lg font-black text-slate-800">{formatUsd(report.totalScopedMonthlyCost)}</p>
        </div>
      </div>

      {report.items.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Upload invoices and add infrastructure resources to run discrepancy checks.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {report.items.map((item) => {
            const Icon = item.severity === 'warning' ? AlertTriangle : Info;
            const iconClass =
              item.severity === 'warning' ? 'text-amber-500' : 'text-sky-500';
            return (
              <li key={item.id} className="px-4 py-3 flex gap-3 text-sm">
                <Icon size={16} className={`shrink-0 mt-0.5 ${iconClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-slate-400">
                    {item.billedAmount != null && item.billedAmount > 0 && (
                      <span>Billed: {formatUsd(item.billedAmount)}</span>
                    )}
                    {item.scopedAmount != null && item.scopedAmount > 0 && (
                      <span>Scope: {formatUsd(item.scopedAmount)}/mo</span>
                    )}
                    {item.invoiceNumbers?.length ? (
                      <span>Invoices: {item.invoiceNumbers.join(', ')}</span>
                    ) : null}
                  </div>
                </div>
                {item.type === 'unscoped_on_invoice' && (
                  <Link
                    to={`/projects/${projectId}?tab=infrastructure`}
                    className="shrink-0 text-[10px] font-bold text-indigo-600 flex items-center gap-0.5 self-center"
                  >
                    Add resource <ChevronRight size={12} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-800">
          {warnings.length} item(s) need review — charges on invoices without a matching scoped resource.
        </div>
      )}
    </div>
  );
};
