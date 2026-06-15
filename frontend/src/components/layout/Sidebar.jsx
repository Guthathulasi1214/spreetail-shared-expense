/**
 * components/layout/Sidebar.jsx
 *
 * Persistent navigation sidebar.
 *
 * Desktop: fixed left panel (w-64), always visible.
 * Mobile:  hidden by default, slides in as an overlay when `isOpen` = true.
 *
 * Two navigation sections:
 *   1. Main nav — Dashboard, Groups, Profile
 *   2. Group nav — shown only when a groupId is present in the URL
 *      (Expenses, Balances, Import, Settle Up — all scoped to that group)
 *
 * Active state: compared against current pathname so it highlights correctly
 * even on deep routes (e.g., /groups/3/balances highlights "Balances").
 */

import { Link, useLocation, useParams } from 'react-router-dom';
import {
  LayoutDashboard, Users, User, Receipt, BarChart2,
  Upload, ArrowLeftRight, LogOut, X, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../ui/Avatar';

// ─── Nav item component ───────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, onClick }) {
  const { pathname } = useLocation();
  // Active if the path starts with `to` (handles nested routes)
  const isActive = to ? pathname === to || pathname.startsWith(to + '/') : false;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150 group
                    text-zinc-400 hover:text-white hover:bg-zinc-800`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150
                  ${isActive
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
      {children}
    </p>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { groupId }      = useParams(); // present when on a group-scoped page

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col
                    bg-zinc-950 border-r border-zinc-800
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* ── Logo ── */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-zinc-800 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-brand-glow">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">
              Split<span className="text-brand-400">Ease</span>
            </span>
          </Link>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <SectionLabel>Main</SectionLabel>
          <NavItem to="/dashboard"  icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/groups"     icon={Users}           label="Groups"    />
          <NavItem to="/profile"    icon={User}            label="Profile"   />

          {/* Group-scoped navigation — only shown when inside a group */}
          {groupId && (
            <>
              <SectionLabel>This Group</SectionLabel>
              <NavItem to={`/groups/${groupId}/expenses`}  icon={Receipt}          label="Expenses"   />
              <NavItem to={`/groups/${groupId}/balances`}  icon={BarChart2}        label="Balances"   />
              <NavItem to={`/groups/${groupId}/settle`}    icon={ArrowLeftRight}   label="Settle Up"  />
              <NavItem to={`/groups/${groupId}/import`}    icon={Upload}           label="Import CSV" />
            </>
          )}
        </nav>

        {/* ── User info + Logout ── */}
        {user && (
          <div className="border-t border-zinc-800 p-3 flex-shrink-0">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1">
              <Avatar name={user.name} color={user.avatar_color} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <NavItem icon={LogOut} label="Sign out" onClick={() => logout()} />
          </div>
        )}
      </aside>
    </>
  );
}
