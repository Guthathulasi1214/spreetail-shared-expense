/**
 * pages/GroupDetail.jsx
 *
 * Single group view with tab navigation.
 * Tabs: Members | Expenses | Balances | Import
 * (Expenses/Balances/Import are stubs — filled in Steps 4/5/7)
 *
 * The Members tab is the main feature of Step 3:
 *   - Gantt-style timeline showing each member's active date range
 *   - "Add Member" modal (by email + optional join date)
 *   - "Remove Member" (sets left_at) with a date picker
 *
 * LIVE DEMO TIP: The timeline is a great visual to show during the session —
 * it directly demonstrates the date-range membership design. Open it with
 * Meera's left_at set and show how her bar ends before the April expenses.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users, ChevronRight, UserPlus, UserMinus,
  AlertCircle, Loader2, Calendar, CheckCircle2,
} from 'lucide-react';
import api from '../api/axios';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonMemberRow } from '../components/ui/LoadingSkeleton';

// ─── Date helpers ─────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
function fmtShort(dateStr) {
  if (!dateStr) return 'Now';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function toDateInput(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

// ─── Gantt Timeline ───────────────────────────────────────────────────────────
/**
 * Renders a visual horizontal timeline for all memberships.
 *
 * Algorithm:
 *  1. Find the earliest joined_at and latest (left_at or today) across ALL members
 *  2. For each member, compute (leftOffset%, width%) of their active bar
 *  3. Active member → brand color bar; past member → zinc bar
 *
 * This makes it immediately obvious when Meera left (her bar ends in March)
 * and when Sam joined (his bar starts in April).
 */
function MemberTimeline({ memberships }) {
  if (!memberships.length) return null;

  const today = new Date();
  // Build date range across all memberships
  const allDates = memberships.flatMap((m) => [
    new Date(m.joined_at).getTime(),
    m.left_at ? new Date(m.left_at).getTime() : today.getTime(),
  ]);
  const minMs    = Math.min(...allDates);
  const maxMs    = Math.max(...allDates);
  const totalMs  = maxMs - minMs || 1; // prevent divide-by-zero

  function toPercent(dateStr, fallbackToToday = false) {
    const ms = dateStr ? new Date(dateStr).getTime() : today.getTime();
    return Math.max(0, Math.min(100, ((ms - minMs) / totalMs) * 100));
  }

  const minLabel = new Date(minMs).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const maxLabel = new Date(maxMs).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  return (
    <div className="space-y-3">
      {/* Timeline date axis */}
      <div className="flex items-center pl-44 pr-2 mb-1">
        <span className="text-[10px] text-zinc-600">{minLabel}</span>
        <div className="flex-1 h-px bg-zinc-800 mx-3 relative">
          {/* Midpoint marker */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-700" />
        </div>
        <span className="text-[10px] text-zinc-600">{maxLabel}</span>
      </div>

      {/* Member rows */}
      {memberships.map((m) => {
        const leftPct  = toPercent(m.joined_at);
        const rightPct = toPercent(m.left_at, true);
        const widthPct = Math.max(2, rightPct - leftPct); // min 2% so thin bars are visible

        return (
          <div key={m.id} className="flex items-center gap-3">
            {/* Member identity (fixed width so bars align) */}
            <div className="w-40 flex-shrink-0 flex items-center gap-2.5">
              <Avatar name={m.user.name} color={m.user.avatar_color} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">
                  {m.user.name}
                </p>
                <span className={`text-[10px] font-medium ${m.is_active ? 'text-success-500' : 'text-zinc-500'}`}>
                  {m.is_active ? 'Active' : 'Left'}
                </span>
              </div>
            </div>

            {/* Gantt bar track */}
            <div className="flex-1 h-7 bg-zinc-800/60 rounded-full relative overflow-hidden border border-zinc-800">
              <div
                className={`absolute top-1 bottom-1 rounded-full transition-all duration-500
                  ${m.is_active
                    ? 'bg-brand-600/70 border border-brand-500/30'
                    : 'bg-zinc-600/50 border border-zinc-600/30'
                  }`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            </div>

            {/* Date range label */}
            <div className="w-28 flex-shrink-0 text-right">
              <span className="text-[11px] text-zinc-500">
                {fmtShort(m.joined_at)} – {fmtShort(m.left_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ isOpen, onClose, groupId, onAdded }) {
  const [email, setEmail]       = useState('');
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/groups/${groupId}/members`, {
        email,
        joined_at: joinedAt,
      });
      onAdded(res.data.membership);
      setEmail(''); setJoinedAt(new Date().toISOString().split('T')[0]);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a member"
      subtitle="The person must already have a SplitEase account.">
      {error && (
        <div className="alert-error mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="member-email" className="block text-sm font-medium text-zinc-300">
            Email address
          </label>
          <input
            id="member-email"
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="rohan@example.com"
            className="input-base"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="member-joined" className="block text-sm font-medium text-zinc-300">
            Joined on
            <span className="text-zinc-500 font-normal ml-1">
              (affects which expenses they share)
            </span>
          </label>
          <input
            id="member-joined"
            type="date"
            value={joinedAt}
            onChange={(e) => setJoinedAt(e.target.value)}
            className="input-base"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : 'Add member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Remove Member Modal ──────────────────────────────────────────────────────
function RemoveMemberModal({ isOpen, onClose, member, groupId, onRemoved }) {
  const [leftAt, setLeftAt] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.patch(`/groups/${groupId}/members/${member.user.id}`, { left_at: leftAt });
      onRemoved(member.user.id, leftAt);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update membership');
    } finally {
      setLoading(false);
    }
  }

  if (!member) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remove member"
      subtitle={`Set ${member.user.name}'s leave date. Their past expense splits will be preserved.`}>
      {error && <div className="alert-error mb-4"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
          <Avatar name={member.user.name} color={member.user.avatar_color} size="sm" />
          <div>
            <p className="text-sm font-medium text-white">{member.user.name}</p>
            <p className="text-xs text-zinc-500">Joined {fmt(member.joined_at)}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="left-at" className="block text-sm font-medium text-zinc-300">Leave date</label>
          <input id="left-at" type="date" value={leftAt}
            onChange={(e) => setLeftAt(e.target.value)} className="input-base" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-danger flex-1">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Confirm removal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Tab stub for future steps ─────────────────────────────────────────────────
function ComingSoon({ label, step }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4 text-2xl">
        🚧
      </div>
      <p className="text-zinc-400 font-medium">{label}</p>
      <p className="text-zinc-600 text-sm mt-1">Coming in Step {step}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'members',  label: 'Members'  },
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'import',   label: 'Import'   },
];

export default function GroupDetail() {
  const { groupId } = useParams();

  const [group, setGroup]               = useState(null);
  const [memberships, setMemberships]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [activeTab, setActiveTab]       = useState('members');
  const [showAddMember, setShowAdd]     = useState(false);
  const [removingMember, setRemoving]   = useState(null); // the membership object to remove

  const fetchGroup = useCallback(() => {
    setLoading(true);
    api.get(`/groups/${groupId}`)
      .then((res) => {
        setGroup(res.data.group);
        setMemberships(res.data.group.memberships);
      })
      .catch(() => setError('Could not load this group.'))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  function handleMemberAdded(newMembership) {
    setMemberships((prev) => [...prev, newMembership]);
  }

  function handleMemberRemoved(userId, leftAt) {
    setMemberships((prev) =>
      prev.map((m) =>
        m.user.id === userId ? { ...m, left_at: leftAt, is_active: false } : m
      )
    );
  }

  const activeCount = memberships.filter((m) => m.is_active).length;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link to="/groups" className="hover:text-zinc-300 transition">Groups</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-300 font-medium">{group?.name ?? '…'}</span>
        </nav>

        {/* Loading state */}
        {loading && (
          <div className="space-y-6">
            <div className="skeleton h-8 w-64 rounded-xl" />
            <div className="skeleton h-4 w-40 rounded" />
            <div className="space-y-4 mt-8">
              {[1,2,3].map(i => <SkeletonMemberRow key={i} />)}
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loaded state */}
        {!loading && group && (
          <>
            {/* Group header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h1 className="text-2xl font-bold text-white">{group.name}</h1>
                {group.description && (
                  <p className="text-zinc-400 text-sm mt-1">{group.description}</p>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-4 mb-8">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Users className="w-3.5 h-3.5" />
                {activeCount} active {activeCount === 1 ? 'member' : 'members'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Calendar className="w-3.5 h-3.5" />
                Created {fmt(group.created_at)}
              </span>
              {group.Creator && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  by {group.Creator.name}
                </span>
              )}
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-xl mb-8 w-fit border border-zinc-800">
              {TABS.map(({ key, label }) => (
                <Link
                  key={key}
                  to={key === 'members' ? `/groups/${groupId}` : `/groups/${groupId}/${key}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    activeTab === key
                      ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'members' && (
              <div className="animate-fade-in">
                {/* Members header + action */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-white">Member timeline</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Bars show each person's active date range — balances only include expenses within their period.
                    </p>
                  </div>
                  <button
                    id="add-member-btn"
                    onClick={() => setShowAdd(true)}
                    className="btn-secondary"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add member
                  </button>
                </div>

                {/* Timeline */}
                {memberships.length === 0 ? (
                  <EmptyState icon={Users} title="No members yet"
                    message="Add members to start splitting expenses." />
                ) : (
                  <div className="card">
                    <MemberTimeline memberships={memberships} />
                  </div>
                )}

                {/* Member list with remove actions */}
                <div className="mt-6 space-y-2">
                  {memberships.map((m) => (
                    <div key={m.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800
                                 hover:border-zinc-700 bg-zinc-900/50 transition group">
                      <Avatar name={m.user.name} color={m.user.avatar_color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{m.user.name}</p>
                          {m.is_active
                            ? <span className="badge-success"><CheckCircle2 className="w-2.5 h-2.5" /> Active</span>
                            : <span className="badge-neutral">Left</span>
                          }
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {fmt(m.joined_at)}
                          {m.left_at ? ` → ${fmt(m.left_at)}` : ' → present'}
                        </p>
                      </div>
                      {m.is_active && (
                        <button
                          onClick={() => setRemoving(m)}
                          className="opacity-0 group-hover:opacity-100 btn-ghost py-1.5 px-2.5 text-zinc-500 hover:text-danger-400 transition-all"
                          aria-label={`Remove ${m.user.name}`}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'expenses' && <ComingSoon label="Expense management" step="4" />}
            {activeTab === 'balances' && <ComingSoon label="Balance calculation" step="5" />}
            {activeTab === 'import'   && <ComingSoon label="CSV import" step="7" />}
          </>
        )}
      </div>

      {/* Modals */}
      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAdd(false)}
        groupId={groupId}
        onAdded={handleMemberAdded}
      />
      <RemoveMemberModal
        isOpen={!!removingMember}
        onClose={() => setRemoving(null)}
        member={removingMember}
        groupId={groupId}
        onRemoved={handleMemberRemoved}
      />
    </Layout>
  );
}
