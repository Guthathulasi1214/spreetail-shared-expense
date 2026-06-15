/**
 * pages/Dashboard.jsx
 *
 * Overview of global user balances and recent activity across all groups.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CreditCard, TrendingUp, TrendingDown, ArrowRight, Wallet } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || { totalPaid: 0, totalOwed: 0, netBalance: 0 };
  const activity = data?.activity || [];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="text-zinc-400 mt-2">Here's your financial overview across all your shared groups.</p>
        </header>

        {/* Hero Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-900/40 to-brand-950 border border-brand-800/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Wallet className="w-16 h-16 text-brand-400" />
            </div>
            <p className="text-sm font-medium text-brand-400/80 mb-2">Total Balance</p>
            <h2 className={`text-4xl font-bold tracking-tight ${stats.netBalance >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
              {stats.netBalance >= 0 ? '+' : '-'}₹{Math.abs(stats.netBalance).toFixed(2)}
            </h2>
            <p className="text-xs text-zinc-400 mt-2">
              {stats.netBalance >= 0 ? 'You are owed in total' : 'You owe in total'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-success-500/10 flex items-center justify-center text-success-500">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium text-zinc-400">Total Paid</p>
            </div>
            <h3 className="text-2xl font-bold text-white">₹{stats.totalPaid.toFixed(2)}</h3>
            <p className="text-xs text-zinc-500 mt-1">Expenses you've covered</p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-danger-500/10 flex items-center justify-center text-danger-500">
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium text-zinc-400">Your Share</p>
            </div>
            <h3 className="text-2xl font-bold text-white">₹{stats.totalOwed.toFixed(2)}</h3>
            <p className="text-xs text-zinc-500 mt-1">Your portion of group costs</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton w-1/3 h-4 rounded" />
                    <div className="skeleton w-1/4 h-3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Quiet in here"
              message="No recent expenses or settlements across your groups."
              action={{ label: 'Go to Groups', onClick: () => window.location.href = '/groups' }}
            />
          ) : (
            <div className="space-y-6">
              {activity.map(act => (
                <div key={act.id} className="flex items-start gap-4 group">
                  <Avatar name={act.actor} color={act.actorColor} size="md" />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-zinc-300">
                      <span className="font-semibold text-white">{act.actor}</span>
                      {act.type === 'expense' ? (
                        <> added <span className="font-semibold text-white">{act.description}</span></>
                      ) : (
                        <> paid <span className="font-semibold text-white">{act.target}</span></>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-500">
                      <Link to={`/groups/${act.groupId}`} className="font-medium text-brand-400/80 hover:text-brand-300 transition">
                        {act.groupName}
                      </Link>
                      <span>•</span>
                      <span>{new Date(act.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-bold ${act.type === 'settlement' ? 'text-success-400' : 'text-white'}`}>
                      ₹{act.amount.toFixed(2)}
                    </p>
                    {act.type === 'expense' && act.myShare > 0 && (
                      <p className="text-xs text-danger-400 font-medium mt-0.5">
                        You owe ₹{act.myShare.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
