/**
 * pages/Groups.jsx
 *
 * Groups list page — shows all groups the user is a member of.
 *
 * States:
 *   loading   → skeleton grid
 *   error     → error alert
 *   empty     → EmptyState with "Create your first group" CTA
 *   populated → card grid, each card with stacked member avatars
 *
 * Create Group modal: name + optional description, submits to POST /api/groups.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, AlertCircle, Loader2, Calendar } from 'lucide-react';
import api from '../api/axios';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGroupGrid } from '../components/ui/LoadingSkeleton';

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card-hover cursor-pointer group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate group-hover:text-brand-400 transition">
            {group.name}
          </h3>
          {group.description && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{group.description}</p>
          )}
        </div>
        {/* Member count badge */}
        <span className="badge-neutral ml-3 flex-shrink-0">
          <Users className="w-3 h-3" />
          {group.member_count}
        </span>
      </div>

      {/* Stacked member avatars */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex -space-x-2">
          {group.members_preview.slice(0, 4).map((m) => (
            <Avatar
              key={m.id}
              name={m.name}
              color={m.avatar_color}
              size="sm"
              className="ring-2 ring-zinc-900"
            />
          ))}
          {group.member_count > 4 && (
            <div className="w-8 h-8 rounded-full bg-zinc-800 ring-2 ring-zinc-900
                            flex items-center justify-center text-[10px] text-zinc-400 font-medium flex-shrink-0">
              +{group.member_count - 4}
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-500">
          {group.member_count === 1 ? '1 member' : `${group.member_count} members`}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
        <span className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Calendar className="w-3 h-3" />
          {new Date(group.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span className="text-xs font-medium text-brand-400 group-hover:underline">
          View group →
        </span>
      </div>
    </div>
  );
}

// ─── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({ isOpen, onClose, onCreated }) {
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/groups', { name, description });
      onCreated(res.data.group);
      setName(''); setDesc('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a new group"
      subtitle="Give your group a name — you can add members after.">
      {error && (
        <div className="alert-error mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="group-name" className="block text-sm font-medium text-zinc-300">
            Group name <span className="text-danger-500">*</span>
          </label>
          <input
            id="group-name"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Goa Trip 2026, Flat 4B"
            className="input-base"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="group-desc" className="block text-sm font-medium text-zinc-300">
            Description <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            id="group-desc"
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What's this group for?"
            rows={2}
            className="input-base resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Groups() {
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const fetchGroups = useCallback(() => {
    setLoading(true);
    api.get('/groups')
      .then((res) => setGroups(res.data.groups))
      .catch(() => setError('Could not load your groups. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  function handleCreated(newGroup) {
    // Immediately navigate to the new group — no need to refetch list
    navigate(`/groups/${newGroup.id}`);
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Your groups</h1>
            <p className="text-sm text-zinc-500 mt-1">
              All groups where you are an active member
            </p>
          </div>
          <button
            id="create-group-btn"
            onClick={() => setShowCreate(true)}
            className="btn-primary w-auto px-5 py-2.5"
          >
            <Plus className="w-4 h-4" />
            New group
          </button>
        </div>

        {/* Content states */}
        {loading && <SkeletonGroupGrid count={6} />}

        {!loading && error && (
          <div className="alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <EmptyState
            icon={Users}
            title="No groups yet"
            message="Create your first group to start splitting expenses with friends, flatmates, or travel companions."
            action={{ label: '+ Create your first group', onClick: () => setShowCreate(true) }}
          />
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                onClick={() => navigate(`/groups/${g.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </Layout>
  );
}
