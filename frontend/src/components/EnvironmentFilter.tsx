import { Layers } from 'lucide-react';
import { ENVIRONMENTS } from '../constants/tools';

export interface EnvironmentFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  compact?: boolean;
}

export function EnvironmentFilter({
  value,
  onChange,
  className = '',
  compact = false,
}: EnvironmentFilterProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-2 ${className}`}
    >
      <Layers size={compact ? 14 : 16} className="text-emerald-500 shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Environment
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[140px]"
      >
        <option value="">All environments</option>
        {ENVIRONMENTS.map((env) => (
          <option key={env} value={env}>
            {env}
          </option>
        ))}
      </select>
    </div>
  );
}

export default EnvironmentFilter;
