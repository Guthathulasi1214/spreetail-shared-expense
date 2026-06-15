/**
 * pages/ImportCsv.jsx
 *
 * Provides a UI to upload a CSV file and review flagged anomalies.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Upload, AlertCircle, Loader2, CheckCircle2, FileText, ListChecks } from 'lucide-react';
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
      fetchData(); // refresh anomalies queue
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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link to="/groups" className="hover:text-zinc-300 transition">Groups</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/groups/${groupId}`} className="hover:text-zinc-300 transition">{group?.name ?? '…'}</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-300 font-medium">Import CSV</span>
        </nav>

        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{group?.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">Import historical expenses and resolve data issues</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary w-auto px-5">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
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
          <div className="mb-8 p-5 rounded-2xl bg-zinc-900 border border-brand-500/30">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success-400" />
              Import Complete
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-sm text-zinc-400">Rows Imported</p>
                <p className="text-2xl font-bold text-success-400">{importResult.rows_imported}</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-sm text-zinc-400">Rows Flagged</p>
                <p className="text-2xl font-bold text-warning-400">{importResult.rows_flagged}</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-sm text-zinc-400">Rows Skipped</p>
                <p className="text-2xl font-bold text-zinc-300">{importResult.rows_skipped}</p>
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Queue */}
        {!loading && !error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <ListChecks className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-white">Approval Queue</h2>
              {anomalies.length > 0 && (
                <span className="bg-warning-500/20 text-warning-400 text-xs font-bold px-2 py-0.5 rounded-full">
                  {anomalies.length}
                </span>
              )}
            </div>

            {anomalies.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Queue is clear!"
                message="All data anomalies have been resolved or no issues were found in the last import."
              />
            ) : (
              <div className="space-y-4">
                {anomalies.map((anomaly) => (
                  <div key={anomaly.id} className="p-5 rounded-xl bg-zinc-900 border border-warning-500/30">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-warning-400">
                            {anomaly.anomaly_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-zinc-500">• Row {anomaly.row_number}</span>
                        </div>
                        <p className="text-sm font-medium text-white mb-2">{anomaly.description}</p>
                        
                        {/* Raw Data Preview */}
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 overflow-x-auto">
                          {JSON.stringify(anomaly.raw_row_data)}
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 shrink-0">
                        <button onClick={() => handleResolve(anomaly.id, true)} className="btn-primary w-full py-1.5 text-sm bg-success-600 hover:bg-success-500 border-success-500">
                          Approve
                        </button>
                        <button onClick={() => handleResolve(anomaly.id, false)} className="btn-secondary w-full py-1.5 text-sm hover:text-danger-400 hover:border-danger-400/30">
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
