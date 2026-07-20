import { Calendar, RotateCcw } from 'lucide-react';
import { lastNMonthsRange } from '../utils/monthPeriod';

export interface MonthPeriodValue {
  fromMonth: string | null;
  toMonth: string | null;
}

export interface MonthPeriodFilterProps {
  value: MonthPeriodValue;
  onChange: (value: MonthPeriodValue) => void;
  className?: string;
  compact?: boolean;
}

export function MonthPeriodFilter({
  value,
  onChange,
  className = '',
  compact = false,
}: MonthPeriodFilterProps) {
  const setFrom = (fromMonth: string) => {
    onChange({ ...value, fromMonth: fromMonth || null });
  };

  const setTo = (toMonth: string) => {
    onChange({ ...value, toMonth: toMonth || null });
  };

  const clear = () => onChange({ fromMonth: null, toMonth: null });

  const applyPreset = (months: number) => {
    const range = lastNMonthsRange(months);
    onChange(range);
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-2 ${className}`}
    >
      <Calendar size={compact ? 14 : 16} className="text-indigo-500 shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Period
      </span>

      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <span className="text-[10px] font-semibold text-slate-400">From</span>
        <input
          type="month"
          value={value.fromMonth ?? ''}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <span className="text-[10px] font-semibold text-slate-400">To</span>
        <input
          type="month"
          value={value.toMonth ?? ''}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </label>

      <div className="flex items-center gap-1 ml-auto">
        <button
          type="button"
          onClick={() => applyPreset(12)}
          className="px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
        >
          Last 12 mo
        </button>
        <button
          type="button"
          onClick={() => applyPreset(6)}
          className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          6 mo
        </button>
        <button
          type="button"
          onClick={clear}
          title="Show all records"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}

export default MonthPeriodFilter;
