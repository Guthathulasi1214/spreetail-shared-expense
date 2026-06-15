/**
 * pages/ImportCsv.jsx
 *
 * Provides a UI to upload a CSV file and review flagged anomalies.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Upload, AlertCircle, Loader2, CheckCircle2, FileText, ListChecks, X, Check, AlertTriangle, Info, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/axios';
import Layout from '../components/layout/Layout';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGroupGrid } from '../components/ui/LoadingSkeleton';

const TABS = [
  { key: 'members',  label: 'Members'  },
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'settle',   label: 'Settle Up'},
  { key: 'import',   label: 'Import'   },
];

const ANOMALY_META = {
  UNKNOWN_MEMBER:    { color: 'orange', icon: AlertTriangle, label: 'Unknown Member' },
  MISSING_PAID_BY:   { color: 'red',    icon: AlertCircle,   label: 'Missing Paid By' },
  ZERO_AMOUNT:       { color: 'red',    icon: AlertCircle,   label: 'Zero Amount' },
  DUPLICATE:         { color: 'blue',   icon: Copy,          label: 'Duplicate Row' },
  INVALID_SPLIT:     { color: 'red',    icon: AlertCircle,   label: 'Invalid Split' },
  STALE_MEMBERSHIP:  { color: 'orange', icon: Info,          label: 'Stale Membership' },
};

function AnomalyCard({ anomaly, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(null);

  const meta = ANOMALY_META[anomaly.anomaly_type] || { color: 'orange', icon: AlertTriangle, label: anomaly.anomaly_type.replace(/_/g, ' ') };
  const Icon = meta.icon;

  const colorMap = {
    red:    { badge: 'bg-red-500/15 text-red-400 border-red-500/30',    card: 'border-red-500/20',    dot: 'bg-red-400' },
    orange: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', card: 'border-amber-500/20', dot: 'bg-amber-400' },
    blue:   { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30', card: 'border-blue-500/20',   dot: 'bg-blue-400' },
  };
  const c = colorMap[meta.color];

  const rawData = typeof anomaly.raw_row_data === 'string'
    ? JSON.parse(anomaly.raw_row_data)
    : anomaly.raw_row_data;

  const handleResolve = async (approved) => {
    setResolving(approved ? 'approve' : 'reject');
    await onResolve(anomaly.id, approved);
  };

  return (
    <div className={`rounded-2xl bg-zinc-900/80 border ${c.card} overflow-hidden transition-all duration-200`}>
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.badge} border`}>
              <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Type + Row badges */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${c.badge}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                  Row {anomaly.row_number}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-200 font-medium leading-snug">
                {anomaly.description}
              </p>

              {/* Action taken */}
              {anomaly.action_taken && (
                <p className="text-xs text-zinc-500 mt-1">
                  ℹ️ {anomaly.action_taken}
                </p>
              )}
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-zinc-500 hover:text-zinc-300 transition p-1 rounded-lg hover:bg-zinc-800 shrink-0"
            title="View raw data"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Raw Data (collapsible) */}
        {expanded && rawData && (
          <div className="mt-4 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="px-3 py-2 bg-zinc-800/60 border-b border-zinc-800 flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400 font-semibold">Raw CSV Data</span>
            </div>
            <div className="p-3 overflow-x-auto">
              <table className="text-xs w-full">
                <tbody>
                  {Object.entries(rawData).map(([k, v]) => v !== '' && v !== undefined && (
                    <tr key={k} className="border-b border-zinc-800/50 last:border-0">
                      <td className="py-1 pr-4 text-zinc-500 font-mono whitespace-nowrap font-semibold">{k}</td>
                      <td className="py-1 text-zinc-300 font-mono break-all">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800/60">
          <button
            onClick={() => handleResolve(true)}
            disabled={resolving !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 hover:border-emerald-500/50 disabled:opacity-50 transition-all duration-150"
          >
            {resolving === 'approve'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />
            }
            Approve & Import
          </button>

          <button
            onClick={() => handleResolve(false)}
            disabled={resolving !== null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50 transition-all duration-150"
          >
            {resolving === 'reject'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <X className="w-3.5 h-3.5" />
            }
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImportCsv() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  const fileInputRef = useRef(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/groups/${groupId}/import/anomalies`)
    ])
    .then(([groupRes, anomaliesRes]) => {
      setGroup(groupRes.data.group);
      setAnomalies(anomaliesRes.data.anomalies);
    })
    .catch(() => setError('Could not load import data.'))
    .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError('');
    setImportResult(null);

    try {
      const res = await api.post(`/groups/${groupId}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data.importLog);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResolve = async (anomalyId, approved) => {
    try {
      await api.post(`/groups/${groupId}/import/anomalies/${anomalyId}/resolve`, { approved });
      setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
    } catch (err) {
      alert('Failed to resolve anomaly.');
    }
  };

  const pendingCount = anomalies.length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link to="/groups" className="hover:text-zinc-300 transition">Groups</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/groups/${groupId}`} className="hover:text-zinc-300 transition">{group?.name ?? '…'}</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-300 font-medium">Import CSV</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{group?.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">Import historical expenses and resolve data issues</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary w-auto px-5">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-xl mt-6 mb-8 w-fit border border-zinc-800 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              to={key === 'members' ? `/groups/${groupId}` : `/groups/${groupId}/${key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                key === 'import'
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {loading && <SkeletonGroupGrid count={2} />}
        {!loading && error && <div className="alert-error mb-6"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

        {/* Import Results Summary */}
        {!loading && importResult && (
          <div className="mb-8 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Import Complete
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                <p className="text-3xl font-bold text-emerald-400 mb-1">{importResult.rows_imported}</p>
                <p className="text-xs text-zinc-500 font-medium">Rows Imported</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                <p className="text-3xl font-bold text-amber-400 mb-1">{importResult.rows_flagged}</p>
                <p className="text-xs text-zinc-500 font-medium">Rows Flagged</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                <p className="text-3xl font-bold text-zinc-400 mb-1">{importResult.rows_skipped}</p>
                <p className="text-xs text-zinc-500 font-medium">Rows Skipped</p>
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Queue */}
        {!loading && !error && (
          <div>
            {/* Queue Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <ListChecks className="w-5 h-5 text-zinc-400" />
                <h2 className="text-lg font-semibold text-white">Approval Queue</h2>
                {pendingCount > 0 && (
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {pendingCount} pending
                  </span>
                )}
              </div>
            </div>

            {anomalies.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Queue is clear!"
                message="All data anomalies have been resolved or no issues were found in the last import."
              />
            ) : (
              <div className="space-y-3">
                {anomalies.map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} onResolve={handleResolve} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
