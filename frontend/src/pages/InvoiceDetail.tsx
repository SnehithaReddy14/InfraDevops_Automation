import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  Copy,
  Undo,
  RotateCcw,
  Save,
  ChevronLeft,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/useAuth';

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const invoiceId = parseInt(id || '');

  // Left panel view states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Form states
  const [formData, setFormData] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [modifiedFields, setModifiedFields] = useState<Record<string, boolean>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoiceDetail', invoiceId],
    queryFn: () => api.get(`/invoices/${invoiceId}`),
    enabled: !isNaN(invoiceId),
  });

  // Populate form states once data loads
  useEffect(() => {
    if (data?.invoice) {
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

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceDetail', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      alert('Invoice approved successfully');
      navigate('/invoices');
    },
    onError: (err: any) => {
      alert(`Approval failed: ${err.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoiceId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceDetail', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoicesList'] });
      alert('Invoice rejected successfully');
      navigate('/invoices');
    },
    onError: (err: any) => {
      alert(`Rejection failed: ${err.message}`);
    },
  });

  if (isLoading || isNaN(invoiceId)) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <span className="text-sm font-semibold text-slate-500">Retrieving details and files...</span>
      </div>
    );
  }

  if (error || !data?.invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Failed to load invoice</h2>
        <p className="text-slate-500 max-w-sm mt-2">
          Make sure the record exists and your server is reachable.
        </p>
      </div>
    );
  }

  const invoice = data.invoice;
  const isPending = invoice.status === 'PENDING_REVIEW';
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE_MANAGER';

  // Handle standard field edits
  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setModifiedFields((prev) => ({ ...prev, [field]: true }));
  };

  // Line item grid operations
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

  // Compute calculated values
  const subtotal = lineItems.reduce((acc, curr) => acc + (parseFloat(curr.quantity) * parseFloat(curr.unitPrice) || 0), 0);
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

  // Check if fields were AI extracted vs modified
  const getFieldHighlight = (field: string) => {
    if (modifiedFields[field]) {
      return 'border-amber-400 focus:ring-amber-300 dark:border-amber-700/50 bg-amber-50/5 dark:bg-amber-950/5';
    }
    // Highlighting extracted fields on load in green
    return 'border-green-400 focus:ring-green-300 dark:border-green-700/50 bg-green-50/5 dark:bg-green-950/5';
  };

  const fileUrl = `http://localhost:5000${invoice.originalFilePath}`;
  const isPdf = invoice.originalFilePath?.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>Verify Invoice: {invoice.invoiceNumber}</span>
              <span className={`px-2 py-0.5 rounded-full text-2xs font-extrabold ${
                invoice.status === 'APPROVED' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}>
                {invoice.status}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Source file: {invoice.originalFilePath?.split('/').pop()} • AI Confidence: {(invoice.aiConfidenceScore * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Approval buttons */}
        <div className="flex items-center space-x-3">
          {canManage && isPending && (
            <>
              <button
                onClick={() => approveMutation.mutate()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-success hover:bg-success/90 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-success/15"
              >
                <CheckCircle size={14} />
                <span>Approve Invoice</span>
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-danger/15"
              >
                <XCircle size={14} />
                <span>Reject</span>
              </button>
            </>
          )}

          <button
            onClick={handleReset}
            disabled={Object.keys(modifiedFields).length === 0}
            className="flex items-center space-x-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Undo size={14} />
            <span>Reset</span>
          </button>
          
          <button
            onClick={handleSave}
            disabled={Object.keys(modifiedFields).length === 0 || updateMutation.isPending}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-md disabled:opacity-50 disabled:translate-y-0 transition-all duration-200"
          >
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Ledger</span>
          </button>
        </div>
      </div>

      {/* Split Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)] min-h-[500px]">
        {/* Left Side: Document Viewer */}
        <div className="lg:col-span-5 glass-card rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-800/80 flex flex-col overflow-hidden bg-slate-900/10">
          {/* Controls Bar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <FileText size={14} className="text-primary" />
              <span>Original Document</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setZoom((prev) => Math.min(2, prev + 0.1))}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                title="Rotate Clockwise"
              >
                <RotateCw size={14} />
              </button>
              <a
                href={fileUrl}
                download
                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                title="Download Source"
              >
                <Download size={14} />
              </a>
            </div>
          </div>

          {/* Render Embed or Image */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-100 dark:bg-slate-950">
            {isPdf ? (
              <iframe
                src={`${fileUrl}#zoom=${zoom * 100}&rotate=${rotation}`}
                className="w-full h-full border-none rounded-lg"
                title="PDF Document"
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
                  alt="Extracted invoice source"
                  className="max-w-full max-h-full rounded shadow"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Zod validated Form */}
        <div className="lg:col-span-7 glass-card rounded-xl shadow-premium border border-slate-200/60 dark:border-slate-800/80 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Extracted Invoice Data Form
            </span>
            <div className="flex items-center space-x-4 text-2xs font-semibold">
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 bg-green-400/25 border border-green-400 rounded-sm" />
                <span className="text-slate-500">AI-Extracted</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 bg-amber-400/25 border border-amber-400 rounded-sm" />
                <span className="text-slate-500">User-Modified</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {formData && (
              <>
                {/* 1. General Header Data */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                        'invoiceNumber'
                      )}`}
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                        'invoiceDate'
                      )}`}
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                        'dueDate'
                      )}`}
                    />
                  </div>
                </div>

                {/* 2. Vendor & Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Vendor */}
                  <div className="space-y-4 border border-slate-100 dark:border-slate-800/80 p-4 rounded-lg bg-slate-50/10 dark:bg-slate-900/5">
                    <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Vendor (Sender)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Vendor Name
                        </label>
                        <input
                          type="text"
                          value={formData.vendorName}
                          onChange={(e) => handleFieldChange('vendorName', e.target.value)}
                          placeholder="Vendor Name"
                          className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                            'vendorName'
                          )}`}
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Vendor Email
                        </label>
                        <input
                          type="email"
                          value={formData.vendorEmail}
                          onChange={(e) => handleFieldChange('vendorEmail', e.target.value)}
                          placeholder="Vendor Email"
                          className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                            'vendorEmail'
                          )}`}
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Vendor Address
                        </label>
                        <textarea
                          rows={2}
                          value={formData.vendorAddress}
                          onChange={(e) => handleFieldChange('vendorAddress', e.target.value)}
                          placeholder="Vendor Address"
                          className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                            'vendorAddress'
                          )}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="space-y-4 border border-slate-100 dark:border-slate-800/80 p-4 rounded-lg bg-slate-50/10 dark:bg-slate-900/5">
                    <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Customer (Billing)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={formData.customerName}
                          onChange={(e) => handleFieldChange('customerName', e.target.value)}
                          placeholder="Customer Name"
                          className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                            'customerName'
                          )}`}
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Customer Email
                        </label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                          placeholder="Customer Email"
                          className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                            'customerEmail'
                          )}`}
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Customer Address
                        </label>
                        <textarea
                          rows={2}
                          value={formData.customerAddress}
                          onChange={(e) => handleFieldChange('customerAddress', e.target.value)}
                          placeholder="Customer Address"
                          className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${getFieldHighlight(
                            'customerAddress'
                          )}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Line Items Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Line Items Ledger
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-2xs font-semibold"
                    >
                      <Plus size={12} />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/10 text-2xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                          <th className="py-2.5 px-3 w-28 text-right">Price</th>
                          <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                          <th className="py-2.5 px-3 w-20 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {lineItems.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                className="w-full px-2.5 py-1 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-primary rounded-lg text-xs text-slate-800 dark:text-slate-200 font-medium"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-primary rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-primary rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-xs text-slate-700 dark:text-slate-300">
                              {(item.quantity * item.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(index)}
                                className="p-1 text-slate-400 hover:text-primary rounded inline-flex"
                                title="Duplicate Row"
                              >
                                <Copy size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(index)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded inline-flex"
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

                {/* 4. Totals & Tax Calculation */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col md:flex-row md:items-start justify-between gap-6">
                  {/* Left Notes/Other Tax fields */}
                  <div className="grid grid-cols-2 gap-4 flex-1 max-w-md">
                    <div>
                      <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        GST / Tax Registration
                      </label>
                      <input
                        type="text"
                        value={formData.gstNumber}
                        onChange={(e) => handleFieldChange('gstNumber', e.target.value)}
                        placeholder="GSTIN"
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:outline-none transition-all ${getFieldHighlight(
                          'gstNumber'
                        )}`}
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        VAT Number
                      </label>
                      <input
                        type="text"
                        value={formData.vatNumber}
                        onChange={(e) => handleFieldChange('vatNumber', e.target.value)}
                        placeholder="VAT ID"
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:outline-none transition-all ${getFieldHighlight(
                          'vatNumber'
                        )}`}
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Purchase Order #
                      </label>
                      <input
                        type="text"
                        value={formData.purchaseOrder}
                        onChange={(e) => handleFieldChange('purchaseOrder', e.target.value)}
                        placeholder="PO Number"
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:outline-none transition-all ${getFieldHighlight(
                          'purchaseOrder'
                        )}`}
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Currency Selector
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => handleFieldChange('currency', e.target.value)}
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:outline-none transition-all ${getFieldHighlight(
                          'currency'
                        )}`}
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculations Grid */}
                  <div className="w-full md:w-80 space-y-3 text-sm border border-slate-200 dark:border-slate-800 p-4 rounded-xl bg-slate-50/10 dark:bg-slate-900/10 font-medium">
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500">
                      <span>Discount (-)</span>
                      <input
                        type="number"
                        value={formData.discount}
                        onChange={(e) => handleFieldChange('discount', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-primary rounded px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="flex justify-between items-center text-slate-500">
                      <span>Tax (+)</span>
                      <input
                        type="number"
                        value={formData.tax}
                        onChange={(e) => handleFieldChange('tax', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-primary rounded px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="flex justify-between items-center text-slate-500">
                      <span>Shipping (+)</span>
                      <input
                        type="number"
                        value={formData.shipping}
                        onChange={(e) => handleFieldChange('shipping', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-primary rounded px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <hr className="border-slate-200 dark:border-slate-800 my-2" />

                    <div className="flex justify-between items-center text-base font-extrabold text-slate-800 dark:text-white">
                      <span>Grand Total ({formData.currency})</span>
                      <span className="text-primary">{grandTotal.toFixed(2)}</span>
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
