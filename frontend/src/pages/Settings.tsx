import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Cpu, 
  Bell, 
  CreditCard, 
  Save, 
  ShieldAlert, 
  Check, 
  RefreshCw,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

export const Settings: React.FC = () => {
  const { user, setUser } = useAuth();
  
  // Persisted or mock local settings state
  const [currency, setCurrency] = useState(() => localStorage.getItem('invoice_default_currency') || 'USD');
  const [confidenceThreshold, setConfidenceThreshold] = useState(() => parseInt(localStorage.getItem('invoice_confidence_threshold') || '80'));
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem('invoice_auto_approve') === 'true');
  const [emailAlerts, setEmailAlerts] = useState(() => localStorage.getItem('invoice_email_alerts') !== 'false');
  const [strictVerification, setStrictVerification] = useState(() => localStorage.getItem('invoice_strict_verification') !== 'false');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (user) {
      const newRole = e.target.value as 'ADMIN' | 'FINANCE_MANAGER' | 'EMPLOYEE' | 'AUDITOR';
      setUser({
        ...user,
        role: newRole,
      });
      alert(`Mock user role updated to: ${newRole.replace('_', ' ')}`);
    }
  };

  const handleSave = () => {
    setSaving(true);
    setSuccess(false);
    
    // Simulate API/Persistence write delay
    setTimeout(() => {
      localStorage.setItem('invoice_default_currency', currency);
      localStorage.setItem('invoice_confidence_threshold', confidenceThreshold.toString());
      localStorage.setItem('invoice_auto_approve', autoApprove.toString());
      localStorage.setItem('invoice_email_alerts', emailAlerts.toString());
      localStorage.setItem('invoice_strict_verification', strictVerification.toString());
      
      setSaving(false);
      setSuccess(true);
      alert('System configurations saved successfully');
      
      setTimeout(() => setSuccess(false), 3000);
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
          <SettingsIcon className="text-primary w-8 h-8" />
          <span>System Configurations</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Configure default currencies, OCR thresholds, email integrations, and mock test roles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Tabs (Vertical Mock) */}
        <div className="space-y-2 md:col-span-1">
          <div className="glass-card p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 space-y-1">
            <button className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm font-semibold bg-primary text-white shadow-md shadow-primary/20 transition-all">
              <Sliders size={18} />
              <span>General Settings</span>
            </button>
            <button 
              onClick={() => alert('Feature unlocked in enterprise tier.')}
              className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Cpu size={18} />
              <span>OCR Model API</span>
            </button>
            <button 
              onClick={() => alert('Feature unlocked in enterprise tier.')}
              className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell size={18} />
              <span>Notifications</span>
            </button>
          </div>
        </div>

        {/* Configurations Panel */}
        <div className="space-y-6 md:col-span-2">
          {/* Card 1: User & Permissions Mock */}
          <div className="glass-card rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-premium">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center space-x-2">
              <User size={16} className="text-primary" />
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                User profile & Mock Permissions
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Guest User'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Email Account
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || 'guest@company.com'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  System Role (Mock Swapping)
                </label>
                <div className="relative">
                  <select
                    value={user?.role || 'EMPLOYEE'}
                    onChange={handleRoleChange}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  >
                    <option value="ADMIN">System Admin (Full Access)</option>
                    <option value="FINANCE_MANAGER">Finance Manager (Audit, Approve, Reject)</option>
                    <option value="AUDITOR">Auditor (Read-Only Audit Logs)</option>
                    <option value="EMPLOYEE">Employee (Upload & List Only)</option>
                  </select>
                </div>
                <p className="text-2xs text-slate-400 mt-1.5 flex items-center space-x-1">
                  <ShieldAlert size={12} className="text-warning" />
                  <span>Switch roles dynamically to test access rights on buttons and approval panels.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: AI OCR Configuration */}
          <div className="glass-card rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-premium">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center space-x-2">
              <Cpu size={16} className="text-primary" />
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Generative AI OCR Settings
              </h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400">
                    Auto-Approval Threshold
                  </label>
                  <span className="text-sm font-extrabold text-primary">{confidenceThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-2xs text-slate-400 mt-1">
                  Invoices parsed with AI OCR confidence score higher than this value can be automatically flagged for routing.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/30">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Active OCR Large Language Model</span>
                  <span className="text-2xs text-slate-400 mt-0.5">Primary parser running for uploaded receipts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">gemini-2.5-flash</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col text-left pr-4">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Strict Field Verification</span>
                    <span className="text-2xs text-slate-400 mt-0.5">Highlight warnings when AI fields differ from manual edits.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={strictVerification}
                    onChange={(e) => setStrictVerification(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4.5 w-4.5 mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex flex-col text-left pr-4">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Background Email Alerts</span>
                    <span className="text-2xs text-slate-400 mt-0.5">Dispatch notifications to audit ledger on low confidence extraction.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4.5 w-4.5 mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Financial defaults */}
          <div className="glass-card rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-premium">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center space-x-2">
              <CreditCard size={16} className="text-primary" />
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Financial Default Settings
              </h2>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Default Ledger Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                >
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
                <p className="text-2xs text-slate-400 mt-1">
                  The default fallback currency applied when AI is unable to confidently identify the invoice monetary symbol.
                </p>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-1.5 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-md disabled:opacity-50 disabled:translate-y-0 transition-all duration-200"
            >
              {saving ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : success ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              <span>{saving ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
