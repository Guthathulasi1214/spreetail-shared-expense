/**
 * pages/SettleUp.jsx
 *
 * Displays a history of all person-to-person payments in the group.
 * Includes a "Record a payment" modal to log new settlements.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeftRight, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGroupGrid } from '../components/ui/LoadingSkeleton';

const TABS = [
  { key: 'members',  label: 'Members'  },
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'settle',   label: 'Settle Up'},
  { key: 'import',   label: 'Import'   },
];

// ─── Record Payment Modal ─────────────────────────────────────────────────────
function RecordPaymentModal({ isOpen, onClose, groupId, memberships, onRecorded }) {
  const { user } = useAuth();
  
  // Find current user's membership to default the payer
  const currentUserMembership = memberships.find(m => m.user.id === user?.id);
  const defaultPayer = currentUserMembership ? currentUserMembership.user.id : (memberships[0]?.user.id || '');
  
  // Find another active user to default the payee
  const otherMembership = memberships.find(m => m.user.id !== defaultPayer);
  const defaultPayee = otherMembership ? otherMembership.user.id : '';

  const [paidBy, setPaidBy] = useState(defaultPayer);
  const [paidTo, setPaidTo] = useState(defaultPayee);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset defaults when opened
  useEffect(() => {
    if (isOpen) {
      setPaidBy(defaultPayer);
      setPaidTo(defaultPayee);
      setAmount('');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [isOpen, defaultPayer, defaultPayee]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (paidBy === paidTo) {
      setError('Payer and Payee cannot be the same person.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/groups/${groupId}/settlements`, {
        paid_by_user_id: paidBy,
        paid_to_user_id: paidTo,
        amount,
        currency: 'INR',
        settled_date: date,
        notes
      });
      onRecorded(res.data.settlement);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record a payment" maxWidth="max-w-md">
      {error && (
        <div className="alert-error mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Payer and Payee Selection */}
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Who paid?</label>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className="input-base">
              {memberships.map(m => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>
          <ArrowLeftRight className="w-5 h-5 text-zinc-600 mt-5" />
          <div className="flex-1 space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">To whom?</label>
            <select value={paidTo} onChange={e => setPaidTo(e.target.value)} className="input-base">
              {memberships.map(m => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Amount (INR)</label>
          <div className="flex">
            <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-zinc-700 bg-zinc-800 text-zinc-400 sm:text-sm">
              ₹
            </span>
            <input required type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input-base rounded-l-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Date</label>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Notes <span className="text-zinc-600">(optional)</span></label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bank transfer, Cash" className="input-base" />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettleUp() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/groups/${groupId}/settlements`)
    ])
    .then(([groupRes, settlementsRes]) => {
      setGroup(groupRes.data.group);
      setSettlements(settlementsRes.data.settlements);
    })
    .catch(() => setError('Could not load settlements.'))
    .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link to="/groups" className="hover:text-zinc-300 transition">Groups</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to={`/groups/${groupId}`} className="hover:text-zinc-300 transition">{group?.name ?? '…'}</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-300 font-medium">Settle Up</span>
        </nav>

        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{group?.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">Record payments between members to clear debts</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary w-auto px-5">
            <ArrowLeftRight className="w-4 h-4" />
            Record payment
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-xl mt-6 mb-8 w-fit border border-zinc-800 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              to={key === 'members' ? `/groups/${groupId}` : `/groups/${groupId}/${key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                key === 'settle'
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

        {!loading && !error && settlements.length === 0 && (
          <EmptyState
            icon={ArrowLeftRight}
            title="No payments recorded"
            message="When someone pays you back, record it here to update the group balances."
            action={{ label: 'Record a payment', onClick: () => setShowModal(true) }}
          />
        )}

        {!loading && !error && settlements.length > 0 && (
          <div className="space-y-4 max-w-3xl">
            {settlements.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3 items-center">
                    <Avatar name={s.Payer?.name} color={s.Payer?.avatar_color} size="md" className="ring-4 ring-zinc-900 relative z-10" />
                    <Avatar name={s.Payee?.name} color={s.Payee?.avatar_color} size="md" className="ring-4 ring-zinc-900 relative z-0 opacity-80" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">
                      {s.Payer?.name} <span className="text-zinc-500 font-normal">paid</span> {s.Payee?.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                      {new Date(s.settled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {s.notes && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                          {s.notes}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-success-400">₹{parseFloat(s.amount).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && group && (
        <RecordPaymentModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          groupId={groupId}
          memberships={group.memberships.filter(m => m.is_active)}
          onRecorded={(newSettlement) => {
            setSettlements(prev => [newSettlement, ...prev]);
            fetchData();
          }}
        />
      )}
    </Layout>
  );
}
