import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  FolderOpen,
  MoreVertical
} from 'lucide-react';
import api from '../utils/api';
import { navigateWithReturn } from '../utils/navigation';
import { useAuth } from '../context/useAuth';
import { MonthPeriodFilter, type MonthPeriodValue } from '../components/MonthPeriodFilter';
import { monthRangeToDateBounds } from '../utils/monthPeriod';

export const InvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const listReturnPath = `${location.pathname}${location.search}`;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Table filters & pagination state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Advanced filter drawer state
  const [showFilters, setShowFilters] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [invoicePeriod, setInvoicePeriod] = useState<MonthPeriodValue>({ fromMonth: null, toMonth: null });

  const handlePeriodChange = (period: MonthPeriodValue) => {
    setInvoicePeriod(period);
    const { startDate: s, endDate: e } = monthRangeToDateBounds(period.fromMonth, period.toMonth);
    setStartDate(s);
    setEndDate(e);
    setPage(1);
  };

  // Table selections
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const columnVisibility = {
    invoiceNumber: true,
    vendorName: true,
    invoiceDate: true,
    dueDate: true,
    grandTotal: true,
    status: true,
    paymentStatus: true,
    aiConfidence: true,
    actions: true,
  };

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    sortBy,
    sortOrder,
  });
  if (status) queryParams.append('status', status);
  if (minAmount) queryParams.append('minAmount', minAmount);
  if (maxAmount) queryParams.append('maxAmount', maxAmount);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoicesList', page, search, status, sortBy, sortOrder, minAmount, maxAmount, startDate, endDate],
    queryFn: () => api.get(`/invoices?${queryParams.toString()}`),
  });

  // Bulk action mutations
  const bulkActionMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: string }) =>
      api.post('/invoices/bulk', { ids, action }),
    onSuccess: (_, variables) => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      alert(`Bulk ${variables.action.toLowerCase()} completed successfully`);
    },
    onError: (err: any) => {
      alert(`Bulk operation failed: ${err.message}`);
    },
  });

  // Single action mutations
  const markPaidMutation = useMutation({
    mutationFn: (id: number) => api.post('/invoices/bulk', { ids: [id], action: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      alert('Invoice status updated to Paid');
    },
    onError: (err: any) => {
      alert(`Operation failed: ${err.message}`);
    },
  });

  const markUnpaidMutation = useMutation({
    mutationFn: (id: number) => api.post('/invoices/bulk', { ids: [id], action: 'UNPAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      alert('Invoice status updated to Unpaid');
    },
    onError: (err: any) => {
      alert(`Operation failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      alert('Invoice deleted successfully');
    },
    onError: (err: any) => {
      alert(`Delete failed: ${err.message}`);
    },
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>, invoices: any[]) => {
    if (e.target.checked) {
      setSelectedIds(invoices.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (action: string) => {
    if (selectedIds.length === 0) return;
    if (action === 'DELETE' && !window.confirm(`Are you sure you want to delete these ${selectedIds.length} invoices?`)) {
      return;
    }
    if (['PAID', 'UNPAID'].includes(action)) {
      const allInvoices = data?.invoices || [];
      const selectedInvoices = allInvoices.filter((inv: any) => selectedIds.includes(inv.id));
      const invalid = selectedInvoices.some((inv: any) => inv.status === 'REJECTED' || inv.status === 'DRAFT');
      if (invalid) {
        alert('Cannot update payment status for draft or rejected invoices.');
        return;
      }
    }
    bulkActionMutation.mutate({ ids: selectedIds, action });
  };

  const handleExport = async (format: string) => {
    try {
      const idsParam = selectedIds.length > 0 ? `?ids=${selectedIds.join(',')}&format=${format}` : `?format=${format}`;
      const response = await api.get(`/invoices/export${idsParam}`);
      
      // Trigger browser file download
      const url = window.URL.createObjectURL(response.blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('[Export Failed]', err);
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const { data: fxRateData } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => api.get('/exchange-rate') as Promise<{ inrPerUsd: number }>,
    staleTime: 60 * 60 * 1000,
  });

  const inrPerUsd = fxRateData?.inrPerUsd ?? 83.5;

  const EXCHANGE_RATES: Record<string, number> = {
    USD: 1.0,
    INR: inrPerUsd,
    EUR: 0.92,
    GBP: 0.78,
  };

  const convertCurrency = (amount: number, from: string | null | undefined, to: string): number => {
    const fromUpper = (from || 'USD').toUpperCase();
    const toUpper = (to || 'USD').toUpperCase();
    if (fromUpper === toUpper) return amount;
    const rateFrom = EXCHANGE_RATES[fromUpper] || 1.0;
    const rateTo = EXCHANGE_RATES[toUpper] || 1.0;
    return (amount / rateFrom) * rateTo;
  };

  const formatCurrency = (val: number, curr?: string) => {
    const defaultCurrency = localStorage.getItem('invoice_default_currency') || 'USD';
    const displayCurrency = curr || defaultCurrency;
    return new Intl.NumberFormat(displayCurrency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: displayCurrency,
      maximumFractionDigits: 0
    }).format(val);
  };

  const getStatusBadge = (s: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      SAVED: 'bg-success/10 text-success dark:bg-success/20',
      SCANNED: 'bg-success/10 text-success dark:bg-success/20',
      PENDING_REVIEW: 'bg-success/10 text-success dark:bg-success/20',
      APPROVED: 'bg-success/10 text-success dark:bg-success/20',
      REJECTED: 'bg-danger/10 text-danger dark:bg-danger/20',
      PAID: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20',
      UNPAID: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20',
    };
    const label = s === 'PENDING_REVIEW' ? 'Saved' : s;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[s] || styles.SAVED}`}>
        {label
          .toLowerCase()
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')}
      </span>
    );
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE_MANAGER';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Invoices
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Audit extracted invoices, perform bulk operations, and export lifecycle reports.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Refresh Invoices"
          >
            <RefreshCw size={16} />
          </button>
          
          {/* Export button */}
          <div className="relative group">
            <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
              <Download size={16} />
              <span>Export</span>
            </button>
            <div className="absolute right-0 top-10 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg hidden group-hover:block z-20 overflow-hidden font-medium text-sm">
              <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Excel (.xlsx)</button>
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">CSV (.csv)</button>
              <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">PDF Summary</button>
              <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">JSON Data</button>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-md shadow-primary/15 transition-all duration-200 hover:-translate-y-0.5"
          >
            Upload in Project
          </button>
        </div>
      </div>

      {/* Search & Basic Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by invoice #, vendor, email..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all duration-200"
          />
        </div>

        {/* Filter Quick Selection */}
        <div className="flex items-center space-x-3 overflow-x-auto pb-1 md:pb-0">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SAVED">Saved</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-semibold transition-colors shadow-sm ${
              showFilters
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter size={14} />
            <span>More Filters</span>
          </button>
        </div>
      </div>

      <MonthPeriodFilter value={invoicePeriod} onChange={handlePeriodChange} />

      {/* Advanced Filter Drawer */}
      {showFilters && (
        <div className="glass-card p-6 rounded-xl border border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <div>
            <label className="block mb-1.5">Min Amount (INR)</label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block mb-1.5">Max Amount (INR)</label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-sm">
          <div className="flex items-center space-x-2 text-sm font-semibold text-primary">
            <Check size={16} />
            <span>{selectedIds.length} row(s) selected</span>
          </div>
          <div className="flex items-center space-x-3">
            {canManage && (
              <>
                <button
                  onClick={() => handleBulkAction('DELETE')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Invoices Table Card */}
      <div className="glass-card rounded-xl overflow-hidden shadow-premium border border-slate-200/60 dark:border-slate-800/80">
        <div className="overflow-x-auto w-full">
          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin mb-4" />
              <span className="text-sm font-semibold text-slate-500">Loading invoice ledger...</span>
            </div>
          ) : error ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <FolderOpen className="w-12 h-12 text-slate-300 mb-4" />
              <span className="text-sm font-semibold text-slate-500">Failed to query invoices. Check DB credentials.</span>
            </div>
          ) : data?.invoices?.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <FolderOpen className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">No Invoices Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                No billing documents match your search criteria. Try removing filters or uploading a new file.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/10">
                  <th className="py-5.5 px-5 w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAll(e, data.invoices)}
                      checked={
                        data.invoices.length > 0 && selectedIds.length === data.invoices.length
                      }
                      className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4 w-4"
                    />
                  </th>
                  {columnVisibility.invoiceNumber && (
                    <th onClick={() => toggleSort('invoiceNumber')} className="py-5.5 px-5 cursor-pointer hover:bg-slate-100/50">
                      Invoice # {sortBy === 'invoiceNumber' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.vendorName && (
                    <th onClick={() => toggleSort('vendorName')} className="py-5.5 px-5 cursor-pointer hover:bg-slate-100/50">
                      Vendor {sortBy === 'vendorName' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.invoiceDate && (
                    <th onClick={() => toggleSort('invoiceDate')} className="py-5.5 px-5 cursor-pointer hover:bg-slate-100/50">
                      Billing Period {sortBy === 'invoiceDate' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.dueDate && (
                    <th onClick={() => toggleSort('dueDate')} className="py-5.5 px-5 cursor-pointer hover:bg-slate-100/50">
                      Due Date {sortBy === 'dueDate' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.grandTotal && (
                    <th onClick={() => toggleSort('grandTotal')} className="py-5.5 px-5 text-right cursor-pointer hover:bg-slate-100/50">
                      Grand Total {sortBy === 'grandTotal' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.status && (
                    <th onClick={() => toggleSort('status')} className="py-5.5 px-5 cursor-pointer hover:bg-slate-100/50">
                      Status {sortBy === 'status' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.paymentStatus && (
                    <th className="py-5.5 px-5 select-none">
                      Payment
                    </th>
                  )}
                  {columnVisibility.aiConfidence && (
                    <th onClick={() => toggleSort('aiConfidenceScore')} className="py-5.5 px-5 cursor-pointer hover:bg-slate-100/50 text-center">
                      AI Confidence {sortBy === 'aiConfidenceScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                    </th>
                  )}
                  {columnVisibility.actions && <th className="py-5.5 px-5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {data.invoices.map((row: any) => {
                  const isRowSelected = selectedIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${
                        isRowSelected ? 'bg-primary/2 dark:bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-5.5 px-5">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => handleSelectRow(row.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4 w-4"
                        />
                      </td>
                      {columnVisibility.invoiceNumber && (
                        <td className="py-5.5 px-5 font-semibold text-slate-800 dark:text-white">
                          {row.invoiceNumber}
                        </td>
                      )}
                      {columnVisibility.vendorName && (
                        <td className="py-5.5 px-5 text-slate-650 dark:text-slate-300 font-medium">
                          {row.vendorName || 'Unknown Vendor'}
                        </td>
                      )}
                      {columnVisibility.invoiceDate && (
                        <td className="py-5.5 px-5 text-slate-600 dark:text-slate-400 font-semibold">
                          {row.billingPeriod || (row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString('default', { month: 'short', year: 'numeric' }) : 'N/A')}
                        </td>
                      )}
                      {columnVisibility.dueDate && (
                        <td className="py-5.5 px-5 text-slate-600 dark:text-slate-400 font-medium">
                          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                      )}
                      {columnVisibility.grandTotal && (
                        <td className="py-5.5 px-5 text-right font-bold text-slate-800 dark:text-white">
                          {(() => {
                            const defaultCurrency = localStorage.getItem('invoice_default_currency') || 'USD';
                            const convertedVal = convertCurrency(row.grandTotal, row.currency, defaultCurrency);
                            return formatCurrency(convertedVal, defaultCurrency);
                          })()}
                        </td>
                      )}
                      {columnVisibility.status && (
                        <td className="py-5.5 px-5">{getStatusBadge(row.status)}</td>
                      )}
                      {columnVisibility.paymentStatus && (
                        <td className="py-5.5 px-5 font-semibold">
                          {row.status === 'PAID' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border border-indigo-500/20">
                              Paid
                            </span>
                          ) : ['APPROVED', 'UNPAID'].includes(row.status) ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-300 border border-orange-500/20">
                              Unpaid
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-650 font-normal">
                              —
                            </span>
                          )}
                        </td>
                      )}
                      {columnVisibility.aiConfidence && (
                        <td className="py-5.5 px-5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              row.aiConfidenceScore > 0.8
                                ? 'bg-success/10 text-success dark:bg-success/20'
                                : row.aiConfidenceScore > 0.6
                                ? 'bg-warning/10 text-warning dark:bg-warning/20'
                                : 'bg-danger/10 text-danger dark:bg-danger/20'
                            }`}
                          >
                            {(row.aiConfidenceScore * 100).toFixed(0)}%
                          </span>
                        </td>
                      )}
                      {columnVisibility.actions && (
                        <td className="py-5.5 px-5 text-right relative" onClick={e => e.stopPropagation()}>
                          <div className="inline-block text-left">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors inline-flex"
                              title="More options"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openMenuId === row.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-20" 
                                  onClick={() => setOpenMenuId(null)} 
                                />
                                
                                <div
                                  className="absolute right-4 mt-1.5 w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 z-30 focus:outline-none overflow-hidden text-left"
                                >
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigateWithReturn(
                                          navigate,
                                          `/invoices/${row.id}`,
                                          listReturnPath,
                                          {
                                            breadcrumbs: [
                                              { label: 'Dashboard', path: '/dashboard' },
                                              { label: 'Invoices', path: '/invoices' },
                                              {
                                                label: row.invoiceNumber || `Invoice ${row.id}`,
                                                path: `/invoices/${row.id}`,
                                              },
                                            ],
                                          }
                                        );
                                      }}
                                      className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                    >
                                      <Eye size={12} className="text-slate-400" />
                                      <span>View Details</span>
                                    </button>

                                    {canManage && !['REJECTED', 'DRAFT'].includes(row.status) && row.status !== 'PAID' && (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          markPaidMutation.mutate(row.id);
                                        }}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                      >
                                        <CheckCircle size={12} className="text-indigo-500" />
                                        <span>Mark Paid</span>
                                      </button>
                                    )}

                                    {canManage && row.status === 'PAID' && (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          markUnpaidMutation.mutate(row.id);
                                        }}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-orange-600 dark:text-orange-450 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                                      >
                                        <XCircle size={12} className="text-orange-500" />
                                        <span>Mark Unpaid</span>
                                      </button>
                                    )}

                                    {canManage && (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          if (window.confirm('Delete this invoice?')) {
                                            deleteMutation.mutate(row.id);
                                          }
                                        }}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold border-t border-slate-100 dark:border-slate-800"
                                      >
                                        <Trash2 size={12} className="text-red-500" />
                                        <span>Delete</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {!isLoading && !error && data && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Showing {data.invoices.length} of {data.pagination.totalCount} invoices
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Page {page} of {data.pagination.totalPages || 1}
              </span>
              <button
                disabled={page === data.pagination.totalPages || data.pagination.totalPages === 0}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
