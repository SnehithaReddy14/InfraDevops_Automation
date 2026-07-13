import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Eye, EyeOff, ShieldAlert, Clock, Globe } from 'lucide-react';
import api from '../utils/api';

export const AuditLogs: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogsList'],
    queryFn: () => api.get('/invoices/audit-logs'),
    refetchInterval: 12000,
  });

  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <History className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
        <h2 className="text-xl font-bold">Failed to load audit logs</h2>
        <p className="text-slate-500 max-w-sm mt-2">
          Verify database credentials and make sure backend is running.
        </p>
      </div>
    );
  }

  const { logs } = data;

  const handleToggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getActionBadgeColor = (action: string) => {
    const maps: Record<string, string> = {
      LOGIN: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      REGISTER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20',
      UPLOAD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20',
      EXTRACT: 'bg-green-100 text-green-700 dark:bg-green-900/20',
      EDIT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20',
      APPROVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20',
      REJECT: 'bg-red-100 text-red-700 dark:bg-red-900/20',
      DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/20',
      DELETE_BULK: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20',
      EXPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20',
    };
    return maps[action] || 'bg-slate-100 text-slate-700';
  };

  const parseJsonSafe = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          Audit Trail <History className="text-primary w-6 h-6" />
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Immutable ledger recording user access sessions, OCR extractions, and manual data updates.
        </p>
      </div>

      {/* Logs Table Card */}
      <div className="glass-card rounded-xl overflow-hidden shadow-premium border border-slate-200/60 dark:border-slate-800/80">
        <div className="overflow-x-auto w-full">
          {logs.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <History className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="font-bold text-slate-800 dark:text-white text-base">No Audit Entries</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                No logs recorded yet. Once users perform actions, history will populate.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/10">
                  <th className="py-4 px-4 w-40">Timestamp</th>
                  <th className="py-4 px-4 w-32">Action</th>
                  <th className="py-4 px-4">User</th>
                  <th className="py-4 px-4 w-32">IP Address</th>
                  <th className="py-4 px-4 w-40">Target Invoice</th>
                  <th className="py-4 px-4 text-right w-24">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {logs.map((log: any) => {
                  const isExpanded = expandedLogId === log.id;
                  const oldObj = parseJsonSafe(log.oldValue);
                  const newObj = parseJsonSafe(log.newValue);
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="py-4 px-4 text-slate-600 dark:text-slate-400 font-medium">
                          <span className="flex items-center space-x-1.5">
                            <Clock size={13} className="text-slate-400" />
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-2xs font-extrabold uppercase ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-700 dark:text-slate-200">
                          {log.user ? `${log.user.name} (${log.user.role.replace('_', ' ')})` : 'System'}
                        </td>
                        <td className="py-4 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                          <span className="flex items-center space-x-1">
                            <Globe size={13} className="text-slate-400" />
                            <span>{log.ipAddress || '127.0.0.1'}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-600 dark:text-slate-400 font-semibold">
                          {log.invoice ? `${log.invoice.invoiceNumber} (${log.invoice.vendorName || 'N/A'})` : 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {(oldObj || newObj) ? (
                            <button
                              onClick={() => handleToggleExpand(log.id)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                              title={isExpanded ? 'Hide Changes' : 'Show Changes'}
                            >
                              {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded json diff viewer */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/50 dark:bg-slate-900/20 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div>
                                <h4 className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                  Before (Old Values)
                                </h4>
                                <pre className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto text-red-500 max-h-60">
                                  {oldObj ? JSON.stringify(oldObj, null, 2) : 'No old value (New document created)'}
                                </pre>
                              </div>
                              <div>
                                <h4 className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                  After (New Values)
                                </h4>
                                <pre className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto text-green-500 max-h-60">
                                  {newObj ? JSON.stringify(newObj, null, 2) : 'No new value (Document deleted)'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
