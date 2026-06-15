/**
 * pages/Expenses.jsx
 *
 * Lists all expenses for a group, and provides the Add Expense flow.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Plus, Receipt, AlertCircle, Loader2, Calendar } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGroupGrid } from '../components/ui/LoadingSkeleton';
import { calculateEqualSplit, calculatePercentageSplit, calculateShareSplit } from '../utils/splitCalculator';

// ─── Add Expense Modal ────────────────────────────────────────────────────────
function AddExpenseModal({ isOpen, onClose, groupId, memberships, onAdded }) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState(user?.id || '');
  const [splitType, setSplitType] = useState('equal');
  
  // Custom split state
  const [customSplits, setCustomSplits] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-initialize custom splits based on members
  useEffect(() => {
    if (isOpen) {
      const initSplits = {};
      memberships.forEach(m => {
        initSplits[m.user.id] = { percentage: parseFloat((100 / memberships.length).toFixed(2)), units: 1, amount: '' };
      });
      setCustomSplits(initSplits);
      setPaidBy(user?.id || memberships[0]?.user?.id);
    }
  }, [isOpen, memberships, user]);

  const handleCustomChange = (userId, field, value) => {
    setCustomSplits(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value === '' ? '' : parseFloat(value) }
    }));
  };

  // Live preview
  const preview = useMemo(() => {
    if (!amount || isNaN(amount)) return [];
    const activeUserIds = memberships.map(m => m.user.id);
    
    if (splitType === 'equal') {
      return calculateEqualSplit(amount, activeUserIds, parseInt(paidBy));
    }
    
    const splitsArray = activeUserIds.map(id => ({
      userId: id,
      percentage: customSplits[id]?.percentage || 0,
      units: customSplits[id]?.units || 0,
      amount: customSplits[id]?.amount || 0
    }));

    if (splitType === 'percentage') {
      return calculatePercentageSplit(amount, splitsArray, parseInt(paidBy));
    } else if (splitType === 'share') {
      return calculateShareSplit(amount, splitsArray, parseInt(paidBy));
    } else if (splitType === 'unequal') {
      return splitsArray.map(s => ({ userId: s.userId, shareAmount: s.amount }));
    }
    return [];
  }, [amount, splitType, customSplits, memberships, paidBy]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const payload = {
      description,
      amount,
      currency,
      paid_by_user_id: paidBy,
      split_type: splitType,
      expense_date: date,
      split_details: {}
    };

    if (splitType === 'equal') {
      payload.split_details.userIds = memberships.map(m => m.user.id);
    } else {
      payload.split_details.splits = memberships.map(m => ({
        userId: m.user.id,
        percentage: customSplits[m.user.id]?.percentage || 0,
        units: customSplits[m.user.id]?.units || 0,
        amount: customSplits[m.user.id]?.amount || 0
      }));
    }

    try {
      const res = await api.post(`/groups/${groupId}/expenses`, payload);
      onAdded(res.data.expense);
      setDescription('');
      setAmount('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add an expense" maxWidth="max-w-2xl">
      {error && (
        <div className="alert-error mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Description</label>
            <input required autoFocus value={description} onChange={e => setDescription(e.target.value)} placeholder="Dinner, Taxi, etc." className="input-base" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Amount</label>
            <div className="flex">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-base rounded-r-none border-r-0 w-24 bg-zinc-800">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
              <input required type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input-base rounded-l-none flex-1" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Paid by</label>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className="input-base">
              {memberships.map(m => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Date</label>
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Split type</label>
          <div className="flex gap-2">
            {['equal', 'unequal', 'percentage', 'share'].map(type => (
              <button key={type} type="button" onClick={() => setSplitType(type)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${splitType === type ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30' : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:text-zinc-300'}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Split Inputs */}
        {splitType !== 'equal' && (
          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-3">
            <h4 className="text-sm font-medium text-white mb-2">Split Details</h4>
            {memberships.map(m => (
              <div key={m.user.id} className="flex items-center gap-3">
                <p className="w-24 truncate text-sm text-zinc-300">{m.user.name}</p>
                {splitType === 'percentage' && (
                  <div className="flex-1 flex items-center gap-2">
                    <input type="number" step="0.01" value={customSplits[m.user.id]?.percentage || ''} onChange={e => handleCustomChange(m.user.id, 'percentage', e.target.value)} className="input-base" placeholder="%" />
                    <span className="text-zinc-500">%</span>
                  </div>
                )}
                {splitType === 'share' && (
                  <div className="flex-1 flex items-center gap-2">
                    <input type="number" step="0.01" value={customSplits[m.user.id]?.units || ''} onChange={e => handleCustomChange(m.user.id, 'units', e.target.value)} className="input-base" placeholder="Units" />
                    <span className="text-zinc-500">units</span>
                  </div>
                )}
                {splitType === 'unequal' && (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-zinc-500">₹</span>
                    <input type="number" step="0.01" value={customSplits[m.user.id]?.amount || ''} onChange={e => handleCustomChange(m.user.id, 'amount', e.target.value)} className="input-base" placeholder="0.00" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Live Preview */}
        {amount && !isNaN(amount) && preview.length > 0 && (
          <div className="bg-brand-950/20 p-4 rounded-xl border border-brand-900/30">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-3">Live Split Preview</h4>
            <div className="space-y-2">
              {preview.map(p => {
                const member = memberships.find(m => m.user.id === p.userId);
                return (
                  <div key={p.userId} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">{member?.user?.name} {p.userId === parseInt(paidBy) && '(Payer)'}</span>
                    <span className="font-medium text-white">₹{p.shareAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                );
              })}
            </div>
            {splitType === 'unequal' && (
              <div className="mt-3 pt-3 border-t border-brand-900/30 flex justify-between text-xs">
                <span className="text-zinc-500">Total Assigned:</span>
                <span className={Math.abs(preview.reduce((a,b) => a + (b.shareAmount||0), 0) - parseFloat(amount)) > 0.01 ? 'text-danger-400 font-bold' : 'text-success-400'}>
                  ₹{preview.reduce((a,b) => a + (b.shareAmount||0), 0).toFixed(2)} / ₹{amount}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Expenses Page ───────────────────────────────────────────────────────
const TABS = [
  { key: 'members',  label: 'Members'  },
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'import',   label: 'Import'   },
];

export default function Expenses() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/groups/${groupId}/expenses`)
    ])
    .then(([groupRes, expenseRes]) => {
      setGroup(groupRes.data.group);
      setExpenses(expenseRes.data.expenses);
    })
    .catch(() => setError('Could not load expenses.'))
    .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`/groups/${groupId}/expenses/${expenseId}`);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    } catch (err) {
      alert('Failed to delete expense.');
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
          <span className="text-zinc-300 font-medium">Expenses</span>
        </nav>

        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{group?.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">Manage shared expenses for this group</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary w-auto px-5">
            <Plus className="w-4 h-4" />
            Add expense
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-xl mt-6 mb-8 w-fit border border-zinc-800">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              to={key === 'members' ? `/groups/${groupId}` : `/groups/${groupId}/${key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                key === 'expenses'
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {loading && <SkeletonGroupGrid count={3} />}
        {!loading && error && <div className="alert-error"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

        {!loading && !error && expenses.length === 0 && (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            message="Add the first expense to start tracking group costs."
            action={{ label: '+ Add expense', onClick: () => setShowAdd(true) }}
          />
        )}

        {!loading && !error && expenses.length > 0 && (
          <div className="space-y-4">
            {expenses.map((expense) => {
              const mySplit = expense.Splits.find(s => s.user_id === user?.id);
              const isPayer = expense.paid_by_user_id === user?.id;
              
              return (
                <div key={expense.id} className="card flex items-center justify-between group/row hover:border-zinc-700 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex flex-col items-center justify-center text-zinc-400">
                      <span className="text-xs uppercase font-semibold">{new Date(expense.expense_date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none mt-0.5">{new Date(expense.expense_date).getDate()}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{expense.description}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
                        <Avatar name={expense.Payer?.name} color={expense.Payer?.avatar_color} size="xs" />
                        {expense.Payer?.name} paid <span className="font-medium">₹{expense.amount_in_inr}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-zinc-500 mb-0.5">Your share</p>
                      {mySplit ? (
                        <p className={`text-sm font-semibold ${isPayer ? 'text-success-400' : 'text-danger-400'}`}>
                          {isPayer ? 'You get back' : 'You owe'} ₹{mySplit.share_amount}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500 font-medium">Not involved</p>
                      )}
                    </div>
                    <button onClick={() => handleDelete(expense.id)} className="text-xs text-danger-400 opacity-0 group-hover/row:opacity-100 transition hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && group && (
        <AddExpenseModal
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          groupId={groupId}
          memberships={group.memberships.filter(m => m.is_active)}
          onAdded={(newExpense) => {
            setExpenses(prev => [newExpense, ...prev]);
            fetchData(); // re-fetch to get full splits with user info if needed
          }}
        />
      )}
    </Layout>
  );
}
