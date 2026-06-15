/**
 * pages/Balances.jsx
 *
 * Displays net balances for each group member and an optimal repayment plan.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, BarChart2, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../api/axios';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGroupGrid } from '../components/ui/LoadingSkeleton';

const TABS = [
  { key: 'members',  label: 'Members'  },
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'import',   label: 'Import'   },
];

export default function Balances() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/groups/${groupId}/balances`)
    ])
    .then(([groupRes, balancesRes]) => {
      setGroup(groupRes.data.group);
      setBalances(balancesRes.data.balances);
      setRepayments(balancesRes.data.repayments);
    })
    .catch(() => setError('Could not load balances.'))
    .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Separate balances into owed and gets back
  const owing = balances.filter(b => b.net_balance <= -0.01).sort((a, b) => a.net_balance - b.net_balance);
  const owed = balances.filter(b => b.net_balance >= 0.01).sort((a, b) => b.net_balance - a.net_balance);
  const settled = balances.filter(b => Math.abs(b.net_balance) < 0.01);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link to="/groups" className="hover:text-zinc-300 transition">Groups</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/groups/${groupId}`} className="hover:text-zinc-300 transition">{group?.name ?? '…'}</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-300 font-medium">Balances</span>
        </nav>

        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{group?.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">Who owes who in the group</p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-xl mt-6 mb-8 w-fit border border-zinc-800">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              to={key === 'members' ? `/groups/${groupId}` : `/groups/${groupId}/${key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                key === 'balances'
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {loading && <SkeletonGroupGrid count={2} />}
        {!loading && error && <div className="alert-error"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

        {!loading && !error && balances.length === 0 && (
          <EmptyState
            icon={BarChart2}
            title="No balances yet"
            message="Add members and expenses to see who owes who."
          />
        )}

        {!loading && !error && balances.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Overview Section */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Current Balances</h2>
              <div className="space-y-3">
                {owed.map(b => (
                  <div key={b.user_id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.name} color={b.avatar_color} size="sm" />
                      <span className="text-sm font-medium text-white">{b.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-success-400">Gets back ₹{b.net_balance.toFixed(2)}</span>
                  </div>
                ))}
                
                {owing.map(b => (
                  <div key={b.user_id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.name} color={b.avatar_color} size="sm" />
                      <span className="text-sm font-medium text-white">{b.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-danger-400">Owes ₹{Math.abs(b.net_balance).toFixed(2)}</span>
                  </div>
                ))}

                {settled.map(b => (
                  <div key={b.user_id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 opacity-60">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.name} color={b.avatar_color} size="sm" />
                      <span className="text-sm font-medium text-white">{b.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-500">Settled up</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repayment Plan Section */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Repayment Plan</h2>
              {repayments.length === 0 ? (
                <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center">
                  <p className="text-zinc-500 text-sm">Everyone is settled up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {repayments.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-brand-950/20 border border-brand-900/30">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-300">{r.from_name}</span>
                        <ArrowRight className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-medium text-white">{r.to_name}</span>
                      </div>
                      <span className="text-sm font-bold text-brand-400">₹{r.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  <div className="pt-4 mt-2 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 text-center">
                      This is the most efficient way to settle all debts.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}
