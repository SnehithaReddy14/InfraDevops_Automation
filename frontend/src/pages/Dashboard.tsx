import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import {
  FileText,
  DollarSign,
  TrendingUp,
  Sparkles,
  Layers,
  Folder,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { MonthPeriodFilter, type MonthPeriodValue } from '../components/MonthPeriodFilter';
import { EnvironmentFilter } from '../components/EnvironmentFilter';
import { isWithinMonthRange } from '../utils/monthPeriod';

const COLORS = ['#6366F1', '#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

interface BillingMatrix {
  projects: { id: number; name: string; code: string }[];
  months: {
    month: string;
    cells: { projectId: number; amount: number }[];
    rowTotal: number;
  }[];
  columnTotals: { projectId: number; amount: number }[];
  grandTotal: number;
}

function projectSeriesKey(projectId: number) {
  return `project_${projectId}`;
}

export const Dashboard: React.FC = () => {
  const defaultCurrency = localStorage.getItem('invoice_default_currency') || 'USD';
  const [period, setPeriod] = useState<MonthPeriodValue>({ fromMonth: null, toMonth: null });
  const [environment, setEnvironment] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardStats', defaultCurrency, environment],
    queryFn: () => {
      const params = new URLSearchParams({ defaultCurrency });
      if (environment) params.set('environment', environment);
      return api.get(`/invoices/dashboard-stats?${params.toString()}`);
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(defaultCurrency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: defaultCurrency,
      maximumFractionDigits: 0,
    }).format(val);

  const matrix = (data as { billingMatrix?: BillingMatrix } | undefined)?.billingMatrix ?? {
    projects: [],
    months: [],
    columnTotals: [],
    grandTotal: 0,
  };

  const filteredMonths = useMemo(
    () => matrix.months.filter((row) => isWithinMonthRange(row.month, period.fromMonth, period.toMonth)),
    [matrix.months, period]
  );

  const projectTrendData = useMemo(() => {
    return filteredMonths.map((row) => {
      const point: Record<string, string | number> = { month: row.month };
      matrix.projects.forEach((project) => {
        const cell = row.cells.find((c) => c.projectId === project.id);
        point[projectSeriesKey(project.id)] = cell?.amount ?? 0;
      });
      point.total = row.rowTotal;
      return point;
    });
  }, [filteredMonths, matrix.projects]);

  const filteredColumnTotals = useMemo(() => {
    return matrix.projects.map((project) => {
      const amount = filteredMonths.reduce((sum, row) => {
        const cell = row.cells.find((c) => c.projectId === project.id);
        return sum + (cell?.amount ?? 0);
      }, 0);
      return { projectId: project.id, amount };
    });
  }, [filteredMonths, matrix.projects]);

  const filteredGrandTotal = useMemo(
    () => filteredMonths.reduce((sum, row) => sum + row.rowTotal, 0),
    [filteredMonths]
  );

  const distinctEnvs =
    (data as { distinctInvoiceEnvironments?: string[] } | undefined)?.distinctInvoiceEnvironments ?? [];
  const showEnvFilter = distinctEnvs.length > 1;

  useEffect(() => {
    if (!showEnvFilter && environment) setEnvironment(null);
  }, [showEnvFilter, environment]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl shimmer" />
          <div className="h-4 w-96 bg-slate-200 dark:bg-slate-800 rounded-lg shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800/80 shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-850 rounded-2xl shimmer" />
          <div className="h-96 bg-slate-200 dark:bg-slate-850 rounded-2xl shimmer" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-2xl p-8 max-w-md mx-auto">
        <Layers className="w-16 h-16 text-indigo-500/30 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-850 dark:text-white">Failed to load dashboard data</h2>
        <p className="text-slate-500 max-w-sm mt-2 text-sm">
          Make sure your backend server is running and the database is configured.
        </p>
      </div>
    );
  }

  const { metrics, charts } = data as {
    metrics: {
      totalInvoices: number;
      totalRevenue: number;
      projectCount: number;
      uniqueVendors: number;
    };
    charts: {
      monthlyRevenue: { name: string; value: number }[];
      vendorSpending: { name: string; value: number }[];
    };
  };

  const statCards = [
    {
      title: 'Total Invoices',
      value: metrics.totalInvoices,
      icon: FileText,
      gradient: 'from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign,
      gradient: 'from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Active Projects',
      value: metrics.projectCount,
      icon: Folder,
      gradient: 'from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10',
      iconColor: 'text-purple-650 dark:text-purple-400',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            Executive Ledger <Sparkles className="text-indigo-600 dark:text-indigo-400 w-6 h-6 animate-pulse" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monthly project spend trends and billing overview across your workspaces.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 rounded-xl px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 self-start md:self-auto">
          <TrendingUp className="w-4 h-4" />
          <span>Platform Status: Live</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <MonthPeriodFilter value={period} onChange={setPeriod} className="flex-1" />
        {showEnvFilter && (
          <EnvironmentFilter value={environment} onChange={setEnvironment} className="lg:w-auto" />
        )}
      </div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 100, delay: i * 0.05 }}
              className="glass-card card-hover-lift glow-border p-6 rounded-2xl relative overflow-hidden group"
            >
              <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-gradient-to-tr ${card.gradient} blur-xl opacity-60 group-hover:scale-125 transition-transform duration-500`} />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-550">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 ${card.iconColor}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-5">
                <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {card.value}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-2 glass-card p-6 rounded-2xl relative overflow-hidden"
        >
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base uppercase tracking-wide">
                Monthly Project Spend Trends
              </h3>
              <p className="text-xs text-slate-550 mt-0.5">
                Line graph tracking individual project cost streams over time
              </p>
            </div>
            <TrendingUp size={18} className="text-[#FF9900] shrink-0 mt-0.5" />
          </div>
          <div className="h-80 w-full">
            {projectTrendData.length > 0 && matrix.projects.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  key={`trends-${period.fromMonth ?? 'all'}-${period.toMonth ?? 'all'}-${projectTrendData.map((d) => d.month).join('|')}`}
                  data={projectTrendData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-slate-900" />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value, name) => {
                      const num = Number(value ?? 0);
                      if (name === 'Total Spend') return [formatCurrency(num), name];
                      const project = matrix.projects.find((p) => projectSeriesKey(p.id) === name);
                      return [formatCurrency(num), project?.name ?? String(name)];
                    }}
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(229, 231, 235, 0.8)',
                      borderRadius: '12px',
                      color: '#111827',
                      fontSize: '11px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total Spend"
                    stroke="#6366F1"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive
                    animationDuration={1400}
                    animationEasing="ease-out"
                    animationBegin={0}
                  />
                  {matrix.projects.map((project, index) => (
                    <Line
                      key={project.id}
                      type="monotone"
                      dataKey={projectSeriesKey(project.id)}
                      name={project.name}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive
                      animationDuration={1200}
                      animationEasing="ease-out"
                      animationBegin={150 + index * 120}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No project spend data for this period — upload invoices or widen the date range.
              </div>
            )}
          </div>
        </motion.div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Top Vendor Spend</h3>
            <p className="text-xs text-slate-550 mt-0.5">Highest billing volume by vendor</p>
          </div>
          <div className="h-80 w-full">
            {charts.vendorSpending.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.vendorSpending} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#E5E7EB" className="dark:stroke-slate-900" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(229, 231, 235, 0.8)',
                      borderRadius: '12px',
                      color: '#111827',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                    {charts.vendorSpending.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No vendor spending records.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Month × Project billing matrix */}
      <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Monthly Billing by Project</h3>
            <p className="text-xs text-slate-550 mt-0.5">Months on the left, projects across the top — filtered by the period calendar above</p>
          </div>
          <Link
            to="/projects"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-550 text-xs font-bold flex items-center space-x-1"
          >
            <span>Manage Projects</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {matrix.projects.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <Folder className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No projects yet.</p>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400"
            >
              Create a project <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60">
                  <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900/95 border-b border-r border-slate-200 dark:border-slate-800 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 min-w-[120px]">
                    Month
                  </th>
                  {matrix.projects.map((project) => (
                    <th
                      key={project.id}
                      className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 min-w-[110px]"
                    >
                      <Link
                        to={`/projects/${project.id}`}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block truncate max-w-[140px] ml-auto"
                        title={project.name}
                      >
                        {project.name}
                      </Link>
                    </th>
                  ))}
                  <th className="border-b border-l border-slate-200 dark:border-slate-800 px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-indigo-50/50 dark:bg-indigo-950/20 min-w-[100px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMonths.length === 0 ? (
                  <tr>
                    <td
                      colSpan={matrix.projects.length + 2}
                      className="px-4 py-10 text-center text-slate-500 text-sm"
                    >
                      No billing data for this period.{' '}
                      <button
                        type="button"
                        onClick={() => setPeriod({ fromMonth: null, toMonth: null })}
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        Clear filter
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredMonths.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    >
                      <td className="sticky left-0 z-10 bg-white dark:bg-[#0f1117] border-r border-slate-200 dark:border-slate-800 px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <Calendar size={13} className="text-indigo-500 shrink-0" />
                          {row.month}
                        </span>
                      </td>
                      {row.cells.map((cell) => (
                        <td
                          key={cell.projectId}
                          className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {cell.amount > 0 ? (
                            <span className="font-medium">{formatCurrency(cell.amount)}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/30 border-l border-slate-200 dark:border-slate-800">
                        {formatCurrency(row.rowTotal)}
                      </td>
                    </tr>
                  ))
                )}
                {filteredMonths.length > 0 && (
                  <tr className="bg-indigo-50/40 dark:bg-indigo-950/20 font-bold">
                    <td className="sticky left-0 z-10 bg-indigo-50/90 dark:bg-indigo-950/40 border-r border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-slate-900 dark:text-white uppercase text-xs tracking-wider">
                      Total
                    </td>
                    {filteredColumnTotals.map((col) => (
                      <td
                        key={col.projectId}
                        className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-right tabular-nums text-slate-900 dark:text-white"
                      >
                        {col.amount > 0 ? formatCurrency(col.amount) : '—'}
                      </td>
                    ))}
                    <td className="border-t border-l border-slate-200 dark:border-slate-800 px-4 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-300">
                      {formatCurrency(filteredGrandTotal)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
