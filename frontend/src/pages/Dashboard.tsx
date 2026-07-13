import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Truck,
  Layers,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import api from '../utils/api';

const COLORS = ['#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#2563EB', '#64748B'];

export const Dashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.get('/invoices/dashboard-stats'),
    refetchInterval: 10000, // Autorefresh every 10s
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        
        {/* Stat Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
        <h2 className="text-xl font-bold">Failed to load dashboard data</h2>
        <p className="text-slate-500 max-w-md mt-2">
          Make sure your backend server is running and the database is configured.
        </p>
      </div>
    );
  }

  const { metrics, charts, recentActivity } = data;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const statCards = [
    {
      title: 'Total Invoices',
      value: metrics.totalInvoices,
      icon: FileText,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign,
      color: 'bg-success/10 text-success',
    },
    {
      title: 'Pending Reviews',
      value: metrics.pendingReview,
      icon: AlertCircle,
      color: 'bg-warning/10 text-warning',
    },
    {
      title: 'Paid Invoices',
      value: metrics.paid,
      icon: CheckCircle,
      color: 'bg-indigo-500/10 text-indigo-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          Executive Dashboard <TrendingUp className="text-primary w-6 h-6" />
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Real-time extraction insights, cashflow analytics, and lifecycle status tracking.
        </p>
      </div>

      {/* Stat Cards Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={i}
              variants={cardVariants}
              transition={{ type: 'spring', stiffness: 100 }}
              className="glass-card p-6 rounded-xl hover:-translate-y-1 transition-all duration-300 shadow-premium group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-lg ${card.color}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                  {card.value}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trend */}
        <div className="lg:col-span-2 glass-card p-6 rounded-xl shadow-premium">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
              Monthly Revenue
            </h3>
            <span className="text-xs text-slate-400">Total approved and paid cashflow over time</span>
          </div>
          <div className="h-80 w-full">
            {charts.monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.monthlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1E293B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No revenue data available yet.
              </div>
            )}
          </div>
        </div>

        {/* Vendor Spending Breakdown */}
        <div className="glass-card p-6 rounded-xl shadow-premium">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
              Top Vendor Spend
            </h3>
            <span className="text-xs text-slate-400">Top 5 vendors with highest billing</span>
          </div>
          <div className="h-80 w-full">
            {charts.vendorSpending.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.vendorSpending} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: '#1E293B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {charts.vendorSpending.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No vendor spending records.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Breakdown and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status breakdown pie chart */}
        <div className="glass-card p-6 rounded-xl shadow-premium">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
              Status Allocation
            </h3>
            <span className="text-xs text-slate-400">Total invoice distribution by monetary volume</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            {charts.statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {charts.statusBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1E293B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-sm">No data available</div>
            )}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-medium">
            {charts.statusBreakdown.map((item: any, index: number) => (
              <div key={item.name} className="flex items-center space-x-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {item.name}: {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="lg:col-span-2 glass-card p-6 rounded-xl shadow-premium flex flex-col justify-between">
          <div>
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                Activity Timeline
              </h3>
              <span className="text-xs text-slate-400">Chronological history of invoices and reviews</span>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity: any) => (
                  <div key={activity.id} className="flex items-start space-x-3 text-sm">
                    {/* Circle icon marker */}
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0 ring-4 ring-primary/20" />
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {activity.description}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          {activity.user} ({activity.role.replace('_', ' ')})
                        </span>
                        <span>•</span>
                        <span>{new Date(activity.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-sm text-center py-10">
                  No system activity recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 flex justify-end">
            <a
              href="/audit-logs"
              className="text-primary hover:text-primary-hover text-xs font-semibold flex items-center space-x-1.5"
            >
              <span>View Audit Logs</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
