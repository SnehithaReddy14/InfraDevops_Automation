import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  Plus,
  Copy,
  Undo,
  Save,
  ChevronLeft,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import api, { getServerBaseUrl } from '../utils/api';
import { goBack } from '../utils/navigation';
import {
  isSubscriptionInvoice,
  readSubscriptionLines,
  formatBillingSeats,
  billingUnitLabel,
} from '../utils/saasUtils';

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const invoiceId = parseInt(id || '');

  // Document zoom & rotation states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Form editing states
  const [formData, setFormData] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [modifiedFields, setModifiedFields] = useState<Record<string, boolean>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoiceDetail', invoiceId],
    queryFn: () => api.get(`/invoices/${invoiceId}`),
    enabled: !isNaN(invoiceId),
  });

  // Load backend variables into state
  useEffect(() => {
    const inv = data?.invoice || data;
    if (inv) {
      setFormData({
        invoiceNumber: inv.invoiceNumber || '',
        invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
        dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : '',
        vendorName: inv.vendorName || '',
        vendorAddress: inv.vendorAddress || '',
        vendorEmail: inv.vendorEmail || '',
        vendorPhone: inv.vendorPhone || '',
        customerName: inv.customerName || '',
        customerAddress: inv.customerAddress || '',
        customerEmail: inv.customerEmail || '',
        customerPhone: inv.customerPhone || '',
        gstNumber: inv.gstNumber || '',
        vatNumber: inv.vatNumber || '',
        purchaseOrder: inv.purchaseOrder || '',
        currency: inv.currency || 'USD',
        discount: inv.discount || 0,
        tax: inv.tax || 0,
        shipping: inv.shipping || 0,
        billingPeriod: inv.billingPeriod || '',
      });
      setLineItems(inv.items || []);
      setModifiedFields({});
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updatedData: any) => api.put(`/invoices/${invoiceId}`, updatedData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceDetail', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      setModifiedFields({});
      alert('Invoice updated successfully');
    },
    onError: (err: any) => {
      alert(`Update failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      const cached = queryClient.getQueryData(['invoiceDetail', invoiceId]) as { invoice?: { projectId?: number }; projectId?: number } | undefined;
      const projectId = cached?.invoice?.projectId ?? cached?.projectId;
      goBack(navigate, location, {
        projectId,
        defaultPath: projectId ? `/projects/${projectId}?tab=invoices` : '/invoices',
      });
    },
    onError: (err: any) => {
      alert(`Delete failed: ${err.message}`);
    },
  });

  const invoiceRecord = data?.invoice || data;

  if (isLoading || isNaN(invoiceId)) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retrieving ledger and document files...</span>
      </div>
    );
  }

  if (error || !invoiceRecord) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-2xl p-8 max-w-md mx-auto">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Failed to load invoice</h2>
        <p className="text-slate-500 max-w-sm mt-2 text-sm">
          Make sure the record exists and your server is reachable.
        </p>
      </div>
    );
  }

  const invoice = invoiceRecord;
  const subscriptionLines = readSubscriptionLines(invoice.metadata);
  const isSubscription = isSubscriptionInvoice(invoice.vendorName, invoice.metadata);

  const handleBack = () => {
    goBack(navigate, location, {
      projectId: invoice.projectId,
      defaultPath: '/invoices',
    });
  };

  const isSavedStatus = ['SAVED', 'SCANNED', 'APPROVED', 'PAID', 'UNPAID'].includes(invoice.status);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setModifiedFields((prev) => ({ ...prev, [field]: true }));
  };

  const handleItemChange = (index: number, key: string, value: any) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [key]: value };
    setLineItems(newItems);
    setModifiedFields((prev) => ({ ...prev, items: true }));
  };

  const handleAddItem = () => {
    setLineItems((prev) => [...prev, { description: 'New Line Item', quantity: 1, unitPrice: 0, amount: 0 }]);
    setModifiedFields((prev) => ({ ...prev, items: true }));
  };

  const handleDuplicateItem = (index: number) => {
    const copied = { ...lineItems[index], id: undefined };
    setLineItems((prev) => [...prev.slice(0, index + 1), copied, ...prev.slice(index + 1)]);
    setModifiedFields((prev) => ({ ...prev, items: true }));
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setModifiedFields((prev) => ({ ...prev, items: true }));
  };

  const subtotal = lineItems.reduce((acc, curr) => acc + ((parseFloat(curr.quantity) || 1) * (parseFloat(curr.unitPrice) || 0)), 0);
  const grandTotal = subtotal - (parseFloat(formData?.discount) || 0) + (parseFloat(formData?.tax) || 0) + (parseFloat(formData?.shipping) || 0);

  const handleReset = () => {
    if (window.confirm('Discard all unsaved edits?')) {
      const inv = data.invoice;
      setFormData({
        invoiceNumber: inv.invoiceNumber || '',
        invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
        dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : '',
        vendorName: inv.vendorName || '',
        vendorAddress: inv.vendorAddress || '',
        vendorEmail: inv.vendorEmail || '',
        vendorPhone: inv.vendorPhone || '',
        customerName: inv.customerName || '',
        customerAddress: inv.customerAddress || '',
        customerEmail: inv.customerEmail || '',
        customerPhone: inv.customerPhone || '',
        gstNumber: inv.gstNumber || '',
        vatNumber: inv.vatNumber || '',
        purchaseOrder: inv.purchaseOrder || '',
        currency: inv.currency || 'USD',
        discount: inv.discount || 0,
        tax: inv.tax || 0,
        shipping: inv.shipping || 0,
        billingPeriod: inv.billingPeriod || '',
      });
      setLineItems(inv.items || []);
      setModifiedFields({});
    }
  };

  const handleSave = () => {
    const payload = {
      ...formData,
      items: lineItems,
    };
    updateMutation.mutate(payload);
  };

  const getFieldHighlight = (field: string) => {
    if (modifiedFields[field]) {
      return 'border-amber-400/50 focus:ring-amber-400/10 focus:border-amber-400 bg-amber-500/2 dark:bg-amber-500/5';
    }
    return 'border-emerald-500/30 focus:ring-emerald-500/10 focus:border-emerald-500 bg-emerald-500/2 dark:bg-emerald-500/5';
  };

  const fileUrl = invoice.originalFilePath
    ? `${getServerBaseUrl()}${invoice.originalFilePath}`
    : '';
  const isPdf = invoice.originalFilePath?.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-[#1F1F1F] pb-4.5">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="Go back"
          >
            <ChevronLeft size={15} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
              <span>Verify Invoice: {invoice.invoiceNumber}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                isSavedStatus
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : invoice.status === 'REJECTED'
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                {invoice.status
                  .toLowerCase()
                  .split('_')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </span>
            </h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 mt-1">
              Source file: {invoice.originalFilePath?.split('/').pop()} • AI Confidence Score: {(invoice.aiConfidenceScore * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Form state save buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleReset}
            disabled={Object.keys(modifiedFields).length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 border border-slate-205 dark:border-[#1F1F1F] rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Undo size={14} />
            <span>Reset</span>
          </button>
          
          <button
            onClick={() => {
              if (window.confirm('Delete this invoice permanently?')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 transition-colors"
          >
            {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            <span>Delete</span>
          </button>

          <button
            onClick={handleSave}
            disabled={Object.keys(modifiedFields).length === 0 || updateMutation.isPending}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition-all duration-250"
          >
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Details</span>
          </button>
        </div>
      </div>

      {/* Split Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-190px)] min-h-[500px]">
        {/* Left Side: Document Preview Iframe */}
        <div className="lg:col-span-5 glass-card rounded-2xl overflow-hidden flex flex-col bg-slate-50 dark:bg-[#121212]">
          <div className="p-3 border-b border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#121212]/80 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-2">
              <FileText size={13} className="text-indigo-500" />
              <span>Original Document</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => setZoom((prev) => Math.min(2, prev + 0.1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                title="Rotate Clockwise"
              >
                <RotateCw size={13} />
              </button>
              <a
                href={fileUrl}
                download
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                title="Download Document"
              >
                <Download size={13} />
              </a>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-[#080d19]">
            {isPdf ? (
              <iframe
                src={`${fileUrl}#zoom=${zoom * 100}&rotate=${rotation}`}
                className="w-full h-full border-none rounded-xl"
                title="PDF File Preview"
              />
            ) : (
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out',
                }}
                className="max-w-full max-h-full"
              >
                <img
                  src={fileUrl}
                  alt="Extracted invoice data source"
                  className="max-w-full max-h-full rounded-xl shadow-lg border border-slate-200 dark:border-slate-800/80"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Ledger Form Editor */}
        <div className="lg:col-span-7 glass-card rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-[#121212]">
          <div className="px-5 py-3 border-b border-slate-150 dark:border-[#1F1F1F] flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Scanned Meta Ledger
            </span>
            <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-emerald-500/20 border border-emerald-500/50 rounded-full" />
                <span>Extracted</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-amber-500/20 border border-amber-500/50 rounded-full animate-pulse" />
                <span>Modified</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {formData && (
              <>
                 {/* 1. Invoice Numbers and Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all font-semibold ${getFieldHighlight(
                        'invoiceNumber'
                      )}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all font-semibold ${getFieldHighlight(
                        'invoiceDate'
                      )}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all font-semibold ${getFieldHighlight(
                        'dueDate'
                      )}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                      Billing Period
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. June 2026"
                      value={formData.billingPeriod}
                      onChange={(e) => handleFieldChange('billingPeriod', e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all font-semibold ${getFieldHighlight(
                        'billingPeriod'
                      )}`}
                    />
                  </div>
                </div>

                {/* 2. Vendor & Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Vendor Details */}
                  <div className="space-y-4 border border-slate-100 dark:border-slate-800/80 p-4.5 rounded-2xl bg-slate-50/5 dark:bg-slate-900/5">
                    <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Vendor (Sender)
                    </h3>
                    <div className="space-y-3.5 text-xs font-semibold">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-450 dark:text-slate-500">Name</label>
                        <input
                          type="text"
                          value={formData.vendorName}
                          onChange={(e) => handleFieldChange('vendorName', e.target.value)}
                          placeholder="Vendor Name"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all ${getFieldHighlight(
                            'vendorName'
                          )}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-450 dark:text-slate-500">Email Address</label>
                        <input
                          type="email"
                          value={formData.vendorEmail}
                          onChange={(e) => handleFieldChange('vendorEmail', e.target.value)}
                          placeholder="Vendor Email"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-855 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all ${getFieldHighlight(
                            'vendorEmail'
                          )}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-450 dark:text-slate-500">Physical Address</label>
                        <textarea
                          rows={2}
                          value={formData.vendorAddress}
                          onChange={(e) => handleFieldChange('vendorAddress', e.target.value)}
                          placeholder="Vendor Address"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-855 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all ${getFieldHighlight(
                            'vendorAddress'
                          )}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div className="space-y-4 border border-slate-100 dark:border-slate-800/80 p-4.5 rounded-2xl bg-slate-50/5 dark:bg-slate-900/5">
                    <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Customer (Billing)
                    </h3>
                    <div className="space-y-3.5 text-xs font-semibold">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 dark:text-slate-500">Name</label>
                        <input
                          type="text"
                          value={formData.customerName}
                          onChange={(e) => handleFieldChange('customerName', e.target.value)}
                          placeholder="Customer Name"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-855 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all ${getFieldHighlight(
                            'customerName'
                          )}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 dark:text-slate-500">Email Address</label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                          placeholder="Customer Email"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-855 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all ${getFieldHighlight(
                            'customerEmail'
                          )}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-455 dark:text-slate-500">Billing Address</label>
                        <textarea
                          rows={2}
                          value={formData.customerAddress}
                          onChange={(e) => handleFieldChange('customerAddress', e.target.value)}
                          placeholder="Customer Address"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-855 dark:text-slate-200 focus:outline-none focus:ring-4 transition-all ${getFieldHighlight(
                            'customerAddress'
                          )}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription seat breakdown (Jira / Atlassian) */}
                {isSubscription && subscriptionLines.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-extrabold text-slate-450 dark:text-slate-505 uppercase tracking-wide">
                      Billed users & agents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {subscriptionLines.map((line, idx) => (
                        <div
                          key={`${line.product}-${idx}`}
                          className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-1"
                        >
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{line.product}</p>
                          <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                            {formatBillingSeats(line.seatCount, line.billingUnit)}
                          </p>
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Billed: {invoice.currency || 'USD'} {line.amount.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Line Items Editor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-extrabold text-slate-450 dark:text-slate-505 uppercase tracking-wide">
                      Line Items Ledger
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 text-[10px] font-bold"
                    >
                      <Plus size={12} />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 dark:border-[#1F1F1F] rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FAFAFA] dark:bg-[#121212]/50 text-slate-450 dark:text-slate-500 font-bold border-b border-slate-200 dark:border-[#1F1F1F]">
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4 w-24 text-center">{isSubscription ? 'Seats' : 'Qty'}</th>
                          {isSubscription && (
                            <th className="py-3 px-4 w-20 text-center">Unit</th>
                          )}
                          <th className="py-3 px-4 w-28 text-right">{isSubscription ? 'Per seat' : 'Price'}</th>
                          <th className="py-3 px-4 w-28 text-right">Amount</th>
                          <th className="py-3 px-4 w-20 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F1F]">
                        {lineItems.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 dark:hover:bg-slate-850/10">
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-indigo-500 rounded-xl font-medium text-slate-800 dark:text-slate-200"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                value={item.quantity !== undefined ? item.quantity : 1}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleItemChange(index, 'quantity', val);
                                  handleItemChange(index, 'amount', val * (parseFloat(item.unitPrice) || 0));
                                }}
                                className="w-full px-2 py-1.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-205 dark:border-slate-800 text-center focus:outline-none focus:border-indigo-500 rounded-xl font-bold text-slate-800 dark:text-slate-200"
                              />
                            </td>
                            {isSubscription && (
                              <td className="py-3 px-4 text-center text-[10px] font-bold uppercase text-slate-500">
                                {billingUnitLabel(subscriptionLines[index]?.billingUnit)}
                              </td>
                            )}
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                value={item.unitPrice !== undefined ? item.unitPrice : 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleItemChange(index, 'unitPrice', val);
                                  handleItemChange(index, 'amount', (parseFloat(item.quantity) || 1) * val);
                                }}
                                className="w-full px-2 py-1.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-205 dark:border-slate-800 text-right focus:outline-none focus:border-indigo-500 rounded-xl font-bold text-slate-800 dark:text-slate-200"
                              />
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                              {((parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(index)}
                                className="p-1.5 text-slate-450 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex"
                                title="Duplicate Row"
                              >
                                <Copy size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(index)}
                                className="p-1.5 text-slate-455 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex"
                                title="Delete Row"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Totals Grid and Tax registrations */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-5 flex flex-col md:flex-row md:items-start justify-between gap-6">
                  {/* Registrations & POs */}
                  <div className="flex-1 max-w-md space-y-4 font-semibold">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                          GST / Tax Registration
                        </label>
                        <input
                          type="text"
                          value={formData.gstNumber}
                          onChange={(e) => handleFieldChange('gstNumber', e.target.value)}
                          placeholder="GSTIN"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-850 dark:text-slate-200 focus:ring-4 focus:outline-none transition-all ${getFieldHighlight(
                            'gstNumber'
                          )}`}
                        />
                      </div>
                      <div className="space-y-1.5 pt-5">
                        <label className="block text-[10px] text-slate-455 dark:text-slate-500 uppercase tracking-wider">
                          VAT Number
                        </label>
                        <input
                          type="text"
                          value={formData.vatNumber}
                          onChange={(e) => handleFieldChange('vatNumber', e.target.value)}
                          placeholder="VAT ID"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-850 dark:text-slate-200 focus:ring-4 focus:outline-none transition-all ${getFieldHighlight(
                            'vatNumber'
                          )}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                          Purchase Order #
                        </label>
                        <input
                          type="text"
                          value={formData.purchaseOrder}
                          onChange={(e) => handleFieldChange('purchaseOrder', e.target.value)}
                          placeholder="PO Number"
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-850 dark:text-slate-200 focus:ring-4 focus:outline-none transition-all ${getFieldHighlight(
                            'purchaseOrder'
                          )}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                          Currency
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => handleFieldChange('currency', e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-slate-850 dark:text-slate-200 focus:ring-4 focus:outline-none transition-all cursor-pointer ${getFieldHighlight(
                            'currency'
                          )}`}
                        >
                          <option value="INR" className="dark:bg-slate-900">INR (₹)</option>
                          <option value="USD" className="dark:bg-slate-900">USD ($)</option>
                          <option value="EUR" className="dark:bg-slate-900">EUR (€)</option>
                          <option value="GBP" className="dark:bg-slate-900">GBP (£)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Calculations Grid */}
                  <div className="w-full md:w-80 space-y-3 border border-slate-200 dark:border-slate-800 p-4.5 rounded-2xl bg-slate-50/5 dark:bg-slate-900/5 font-semibold text-xs">
                    <div className="flex justify-between items-center text-slate-450 dark:text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-800 dark:text-white">{subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-450 dark:text-slate-550">
                      <span>Discount (-)</span>
                      <input
                        type="number"
                        value={formData.discount}
                        onChange={(e) => handleFieldChange('discount', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-50 dark:bg-slate-850 border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-indigo-500 rounded-xl px-2.5 py-1 font-bold text-slate-850 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-between items-center text-slate-450 dark:text-slate-550">
                      <span>Tax (+)</span>
                      <input
                        type="number"
                        value={formData.tax}
                        onChange={(e) => handleFieldChange('tax', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-50 dark:bg-slate-850 border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-indigo-500 rounded-xl px-2.5 py-1 font-bold text-slate-850 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-between items-center text-slate-455 dark:text-slate-550">
                      <span>Shipping (+)</span>
                      <input
                        type="number"
                        value={formData.shipping}
                        onChange={(e) => handleFieldChange('shipping', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-50 dark:bg-slate-850 border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-indigo-500 rounded-xl px-2.5 py-1 font-bold text-slate-855 dark:text-white"
                      />
                    </div>

                    <hr className="border-slate-200 dark:border-slate-800/80 my-2" />

                    <div className="flex justify-between items-center text-sm font-extrabold text-slate-800 dark:text-white">
                      <span>Grand Total ({formData.currency})</span>
                      <span className="text-indigo-500 dark:text-indigo-400">{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
